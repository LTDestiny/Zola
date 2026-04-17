import { Link } from "react-router-dom";

const menuItems = [
  "ZALO PC",
  "OFFICIAL ACCOUNT",
  "NHA PHAT TRIEN",
  "BAO MAT",
  "TRO GIUP",
  "LIEN HE",
  "BAO CAO VI PHAM",
];

export function HomePage() {
  return (
    <div className="min-h-screen grid grid-rows-[auto_1fr_auto]">
      <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center gap-4">
        <div className="text-zalo-blue text-4xl font-bold leading-none tracking-tight">Zalo</div>
        <nav className="ml-auto hidden lg:flex items-center gap-6">
          {menuItems.map((item) => (
            <a href="#" key={item} className="text-xs font-bold text-slate-800 hover:text-zalo-blue transition-colors">
              {item}
            </a>
          ))}
        </nav>
        <div
          aria-label="avatar"
          className="ml-auto lg:ml-0 size-8 rounded-full border border-sky-200 bg-gradient-to-br from-sky-200 to-cyan-100"
        />
      </header>

      <main className="p-4 md:p-8 grid place-items-center">
        <section className="w-full max-w-6xl rounded-xl bg-white shadow-card grid lg:grid-cols-2 gap-8 p-6 md:p-10">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold leading-tight text-slate-900">
              Tai Zalo PC cho may tinh
            </h1>
            <h2 className="mt-3 text-lg md:text-2xl font-semibold text-slate-800">
              Ung dung Zalo PC da co mat tren Windows, Mac OS, Web
            </h2>
            <ul className="mt-6 space-y-2 text-slate-700 list-disc pl-5 marker:text-zalo-blue">
              <li>Gui file, anh, video cuc nhanh len den 1GB</li>
              <li>Dong bo tin nhan voi dien thoai</li>
              <li>Toi uu cho chat nhom va trao doi cong viec</li>
            </ul>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a
                className="h-11 px-6 rounded-lg bg-zalo-blue text-white inline-flex items-center justify-center font-semibold hover:bg-blue-700 transition-colors"
                href="#"
              >
                Tai ngay
              </a>
              <Link
                className="h-11 px-6 rounded-lg border border-zalo-blue text-zalo-blue inline-flex items-center justify-center font-semibold hover:bg-blue-50 transition-colors"
                to="/login"
              >
                Dung ban web
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="relative min-h-64 grid place-items-center">
            <div className="w-full max-w-[460px] aspect-[16/10] rounded-2xl border-2 border-slate-900 bg-gradient-to-br from-slate-100 to-sky-200 shadow-inner" />
            <div className="absolute left-4 bottom-0 w-20 h-40 rounded-2xl border-2 border-slate-800 bg-gradient-to-br from-slate-100 to-sky-200" />
          </div>
        </section>
      </main>

      <footer className="h-12 bg-white border-t border-slate-200 grid place-items-center px-4 text-center text-xs text-slate-600">
        <p className="truncate md:whitespace-normal">
          © 2012 - 2026 Mot san pham cua Zalo Group · Dieu khoan su dung dich vu
          · Thong bao xu ly du lieu
        </p>
      </footer>
    </div>
  );
}
