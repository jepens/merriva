import type {
  CreatePaymentLinkInput,
  CreatedPaymentLink,
  PaymentGateway,
  PaymentStatus,
  PaymentVerification,
} from "./types";

const PAKASIR_BASE_URL = "https://app.pakasir.com";
const TIMEOUT_MS = 8000;

/**
 * Integrasi Pakasir **API v2** (AUDIT-2026-10-13).
 *
 * v1 dihentikan 20 Oktober 2026. Perbedaan yang menentukan bentuk modul ini,
 * SELURUHNYA diverifikasi dengan memanggil API sandbox sungguhan — dokumen
 * Pakasir sudah terbukti salah dua kali (ia menulis `expired_at` padahal API
 * mengirim `expires_at`, dan menjanjikan `va_number: ""` yang sebenarnya tak
 * ada), jadi tak satu pun bentuk di bawah berasal dari dokumen saja:
 *
 *  * **Membuat link kini panggilan JARINGAN, bukan perakitan URL.** v1 membangun
 *    `/pay/{slug}/{amount}?order_id=..` di klien; v2 menuntut
 *    `POST /api/v2/create-transaction/{slug}/{order_id}` dan mengembalikan
 *    `{txn_id, payment_link}`.
 *  * **`txn_id` menjadi kunci jalur uang.** Status dan pembatalan v2 berkunci
 *    pada `txn_id`, BUKAN `order_id` — memakai `order_id` dijawab 404. Karena itu
 *    `txn_id` wajib disimpan di `orders`.
 *  * **Auth pindah ke header `X-Api-Key`.** Di v1 `api_key` ada di query string,
 *    jadi ia bisa masuk log proxy mana pun. Perbaikan nyata.
 *  * **`find-or-create` berkunci `order_id` SAJA.** `order_id` sama dengan amount
 *    BERBEDA mengembalikan transaksi LAMA dengan HTTP 200 dan mengabaikan amount
 *    baru tanpa galat. Itu sebabnya `createPaymentLink` memverifikasi nominal
 *    sesudah membuat — lihat di bawah.
 *  * **Rate limit 2 permintaan/detik**, dan itu bukan teori: 429 benar-benar
 *    terjadi saat tiga panggilan dikirim berurutan.
 */

/** Bentuk galat Pakasir v2 yang konsisten: `{message, data}`. */
function pesanGalat(body: string): string {
  try {
    const o = JSON.parse(body) as { message?: unknown };
    return typeof o.message === "string" ? o.message : "tanpa pesan";
  } catch {
    return "tanpa pesan";
  }
}

/**
 * Galat Pakasir dengan klasifikasi retry — dipakai pemanggil untuk memutuskan
 * antara "coba lagi nanti" dan "ini salah konfigurasi, jangan coba lagi".
 *
 * `transient` menentukan apakah jalur webhook menjawab 5xx (Pakasir mengulang)
 * atau tidak. 401 SENGAJA tidak transien: api_key yang salah tak akan membaik
 * dengan dicoba ulang, dan membuat Pakasir mengulang selamanya hanya memperburuk
 * plafon 2/detik yang sama.
 */
export class PakasirError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly transient: boolean,
  ) {
    super(message);
    this.name = "PakasirError";
  }
}

function klasifikasi(status: number): boolean {
  if (status === 429) return true; // rate limit → coba lagi
  if (status >= 500) return true; // gangguan sisi Pakasir
  return false; // 400 (nominal/method), 401 (api_key), 404 (txn tak ada)
}

/** URL halaman bayar v2 untuk satu `txn_id`. Murni, bisa diuji tanpa jaringan. */
export function buildPakasirPayUrl(
  paymentLink: string,
  input: Pick<CreatePaymentLinkInput, "redirectUrl" | "qrisOnly">,
): string {
  // `URL` + `searchParams`, BUKAN konkatenasi `?`: bila Pakasir kelak
  // mengembalikan link yang SUDAH punya query string, menempel `?` akan
  // menghasilkan URL rusak yang baru terlihat saat pelanggan mengkliknya.
  const u = new URL(paymentLink);
  u.searchParams.set("redirect", input.redirectUrl);
  if (input.qrisOnly) u.searchParams.set("qris_only", "1");
  return u.toString();
}

/** Status Pakasir → status abstraksi. Lunas = `"completed"` (v1 maupun v2). */
export function mapPakasirStatus(status: unknown): PaymentStatus {
  return status === "completed" ? "paid" : "pending";
}

/**
 * Parse respons `GET /api/v2/transaction-status/{slug}/{txn_id}` (MURNI/teruji).
 *
 * Bentuk NYATA (diverifikasi): `{txn_id, order_id, amount, is_sandbox, status,
 * completed_at}`. Perhatikan **tak ada `payment_method`** — baik saat pending
 * maupun setelah lunas. Itu bukan kehilangan: v1 pun mengembalikan string kosong
 * untuk transaksi `payment_link`.
 *
 * `null` bila bentuk tak dikenal → pemanggil memperlakukannya gagal-verifikasi.
 */
export function parseTransactionStatus(
  data: unknown,
): (PaymentVerification & { txnId: string | null; isSandbox: boolean }) | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const orderCode = typeof o.order_id === "string" ? o.order_id : null;
  const amount = typeof o.amount === "number" ? o.amount : null;
  if (!orderCode || amount === null) return null;
  return {
    orderCode,
    amountIdr: amount,
    status: mapPakasirStatus(o.status),
    // v2 tak punya field ini; dipertahankan di kontrak agar gateway lain bisa.
    paymentMethod: null,
    paidAt: typeof o.completed_at === "string" ? o.completed_at : null,
    txnId: typeof o.txn_id === "string" ? o.txn_id : null,
    isSandbox: o.is_sandbox === true,
  };
}

export class PakasirGateway implements PaymentGateway {
  constructor(
    private readonly projectSlug: string,
    private readonly apiKey?: string,
  ) {}

  private key(): string {
    if (!this.apiKey) throw new Error("PAKASIR_API_KEY belum di-set.");
    return this.apiKey;
  }

  /** Semua panggilan v2 lewat satu pintu: header auth, timeout, klasifikasi galat. */
  private async call(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    // Timeout WAJIB: tanpa ini fetch undici bisa menggantung ~300s dan memacetkan
    // handler webhook (core uang).
    const res = await fetch(`${PAKASIR_BASE_URL}${path}`, {
      method,
      headers: {
        "X-Api-Key": this.key(),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (!res.ok) {
      // JANGAN sertakan header/kunci. Pesan Pakasir sendiri aman dan berguna
      // ("Minimum amount for payment_link is Rp 500").
      throw new PakasirError(
        `Pakasir v2 ${path.split("/")[3] ?? path} HTTP ${res.status}: ${pesanGalat(text)}`,
        res.status,
        klasifikasi(res.status),
      );
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new PakasirError(
        "Pakasir v2: respons bukan JSON",
        res.status,
        true,
      );
    }
  }

  private txnPath(suffix: string): string {
    return `/api/v2/${suffix}`;
  }

  /**
   * Buat (atau temukan) transaksi lalu kembalikan URL bayar + `txn_id`.
   *
   * `find-or-create` berkunci `order_id`, jadi memanggil ulang untuk order yang
   * sama aman dan mengembalikan `txn_id` yang sama — itulah yang membuat
   * percobaan ulang checkout tidak menggandakan transaksi.
   *
   * SESUDAH membuat, nominalnya DIVERIFIKASI lewat status. Alasannya bukan
   * kehati-hatian berlebihan: respons `payment_link` HANYA berisi
   * `{txn_id, payment_link}` — tak ada nominal di dalamnya — sementara
   * find-or-create akan mengembalikan transaksi LAMA bila `order_id` pernah
   * dipakai dengan nominal lain, tanpa satu pun galat. Di v1 nominal tertulis di
   * dalam URL sehingga mustahil berbeda; di v2 jaminan itu hilang dan harus
   * diambil kembali di sini. Tanpa pemeriksaan ini, pelanggan bisa membayar
   * nominal lama lalu aktivasinya ditolak `mismatch` — sudah membayar, tak
   * mendapat apa pun.
   */
  async createPaymentLink(
    input: CreatePaymentLinkInput,
  ): Promise<CreatedPaymentLink> {
    const dibuat = (await this.call(
      "POST",
      this.txnPath(
        `create-transaction/${encodeURIComponent(this.projectSlug)}/${encodeURIComponent(input.orderCode)}`,
      ),
      { method: "payment_link", amount: input.amountIdr },
    )) as { txn_id?: unknown; payment_link?: unknown };

    const txnId =
      typeof dibuat.txn_id === "string" && dibuat.txn_id ? dibuat.txn_id : null;
    const link =
      typeof dibuat.payment_link === "string" && dibuat.payment_link
        ? dibuat.payment_link
        : null;
    if (!txnId || !link) {
      throw new PakasirError(
        "Pakasir v2 create-transaction: bentuk respons tak dikenal",
        null,
        true,
      );
    }
    // `payment_link` datang dari body respons API lalu dipakai mengarahkan
    // browser pelanggan → wajib dipastikan host-nya memang Pakasir, kalau tidak
    // respons yang dikompromikan menjadi open-redirect di jalur uang.
    let host: string;
    try {
      host = new URL(link).host;
    } catch {
      throw new PakasirError(
        "Pakasir v2 create-transaction: payment_link bukan URL",
        null,
        false,
      );
    }
    if (host !== new URL(PAKASIR_BASE_URL).host) {
      throw new PakasirError(
        `Pakasir v2 create-transaction: payment_link host tak dikenal (${host})`,
        null,
        false,
      );
    }

    // Ambil kembali jaminan nominal yang hilang di v2.
    const status = await this.transactionStatus(txnId);
    if (status.orderCode !== input.orderCode) {
      throw new PakasirError(
        "Pakasir v2: order_id transaksi tak cocok dengan order yang diminta",
        null,
        false,
      );
    }
    if (status.amountIdr !== input.amountIdr) {
      throw new PakasirError(
        `Pakasir v2: nominal transaksi (${status.amountIdr}) tak cocok dengan order (${input.amountIdr}) — order_id ini sudah dipakai transaksi lain`,
        null,
        false,
      );
    }

    return { url: buildPakasirPayUrl(link, input), txnId };
  }

  /** `GET /api/v2/transaction-status/{slug}/{txn_id}`. FAIL-CLOSED. */
  private async transactionStatus(txnId: string) {
    const data = await this.call(
      "GET",
      this.txnPath(
        `transaction-status/${encodeURIComponent(this.projectSlug)}/${encodeURIComponent(txnId)}`,
      ),
    );
    const parsed = parseTransactionStatus(data);
    if (!parsed) {
      throw new PakasirError(
        "Pakasir v2 transaction-status: bentuk respons tak dikenal",
        null,
        true,
      );
    }
    return parsed;
  }

  /**
   * Verifikasi OTORITATIF — WAJIB sebelum aktivasi. FAIL-CLOSED: HTTP non-OK,
   * bentuk tak dikenal, atau gema `order_id` yang tak cocok → THROW, dan
   * pemanggil TIDAK mengaktifkan.
   *
   * Verifikasi adalah operasi BACA saja. Ia sengaja TIDAK memanggil
   * create-transaction untuk "memulihkan" `txn_id` yang hilang: jalur ini dipicu
   * endpoint webhook publik, dan menjadikan verifikasi sebuah operasi yang bisa
   * MENCIPTAKAN transaksi berarti pemanggil tak dikenal dapat menerbitkan link
   * pembayaran hidup. `txn_id` yang hilang dilaporkan sebagai galat, bukan
   * ditambal diam-diam.
   */
  async verifyTransaction(
    orderCode: string,
    amountIdr: number,
    txnId?: string | null,
  ): Promise<PaymentVerification> {
    if (!txnId) {
      throw new PakasirError(
        `Pakasir v2: order ${orderCode} tak punya txn_id — tak bisa diverifikasi`,
        null,
        false,
      );
    }
    const parsed = await this.transactionStatus(txnId);
    // Defense-in-depth: respons OTORITATIF wajib menggemakan order yang diminta
    // (jangan terima transaksi lunas milik order lain).
    if (parsed.orderCode !== orderCode) {
      throw new PakasirError(
        "Pakasir v2 transaction-status: order_id tak cocok",
        null,
        false,
      );
    }
    // Transaksi SANDBOX tak boleh mengaktifkan apa pun di produksi.
    if (parsed.isSandbox && process.env.NODE_ENV === "production") {
      throw new PakasirError(
        `Pakasir v2: transaksi SANDBOX di produksi (order ${orderCode})`,
        null,
        false,
      );
    }
    void amountIdr; // nominal dibandingkan pemanggil (`reconcile.ts`).
    return {
      orderCode: parsed.orderCode,
      amountIdr: parsed.amountIdr,
      status: parsed.status,
      paymentMethod: parsed.paymentMethod,
      paidAt: parsed.paidAt,
    };
  }

  /**
   * Batalkan transaksi: `POST /api/v2/cancel-transaction/{slug}/{txn_id}`.
   *
   * Endpoint ini TIDAK TERDOKUMENTASI — ditemukan dengan menebak URL lalu
   * dibedakan dari route yang tak ada lewat bentuk pesan galatnya
   * (`{"message":"Transaction not found","data":null}`, yaitu format API, versus
   * `{"message":"Not found"}`). Karena itu kegagalannya WAJIB terlihat: pemanggil
   * mencatatnya sebagai `cancelFailed` dan melaporkannya.
   */
  async cancelTransaction(
    orderCode: string,
    amountIdr: number,
    txnId?: string | null,
  ): Promise<void> {
    void amountIdr;
    if (!txnId) {
      throw new PakasirError(
        `Pakasir v2: order ${orderCode} tak punya txn_id — tak bisa dibatalkan`,
        null,
        false,
      );
    }
    await this.call(
      "POST",
      this.txnPath(
        `cancel-transaction/${encodeURIComponent(this.projectSlug)}/${encodeURIComponent(txnId)}`,
      ),
      {},
    );
  }

  /**
   * Simulasikan pembayaran — TETAP endpoint v1 `POST /api/paymentsimulation`.
   *
   * Tak ada padanan v2 (`/api/v2/payment-simulation/...` dijawab
   * `{"message":"Not found"}`, yaitu route tak ada). Diverifikasi bahwa simulasi
   * v1 ini MEMANG melunasi transaksi yang dibuat lewat v2: setelah dipanggil,
   * `transaction-status` v2 berubah menjadi `completed` dengan `completed_at`
   * terisi. Berkunci `order_id`+`amount`, bukan `txn_id`.
   *
   * **DILARANG di production** (boundary SPEC) → melempar bila `NODE_ENV=production`.
   */
  async simulatePayment(orderCode: string, amountIdr: number): Promise<void> {
    if (process.env.NODE_ENV === "production") {
      throw new Error("paymentsimulation dilarang di production.");
    }
    const res = await fetch(`${PAKASIR_BASE_URL}/api/paymentsimulation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: this.projectSlug,
        order_id: orderCode,
        amount: amountIdr,
        api_key: this.key(),
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`Pakasir paymentsimulation HTTP ${res.status}`);
    }
  }
}
