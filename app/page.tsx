"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

type SavedCode = {
  id: string;
  slug: string;
  name: string;
  destination: string;
  shortUrl: string;
  scans: number;
  account_id?: string;
};

type Account = { id: string; name: string; email: string; role: "master" | "license"; max_qr: number };
type AdminAccount = Account & { status: string; expires_at: string | null; qr_count: number; total_scans: number };
type AdminData = { accounts: AdminAccount[]; codes: (SavedCode & { owner_name?: string })[] };

const DEMO_URL = "https://tusitio.com";

export default function Home() {
  const [destination, setDestination] = useState(DEMO_URL);
  const [name, setName] = useState("Campaña principal");
  const [color, setColor] = useState("#0B1F3A");
  const [qrData, setQrData] = useState("");
  const [saved, setSaved] = useState<SavedCode | null>(null);
  const [codes, setCodes] = useState<SavedCode[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [license, setLicense] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [licenseName, setLicenseName] = useState("");
  const [licenseEmail, setLicenseEmail] = useState("");
  const [licenseLimit, setLicenseLimit] = useState(25);
  const [generatedKey, setGeneratedKey] = useState("");

  async function loadCodes(selectFirst = false) {
    const response = await fetch("/api/codes");
    if (!response.ok) return;
    const data = await response.json() as { codes: SavedCode[] };
    setCodes(data.codes);
    if (selectFirst && data.codes[0]) selectCode(data.codes[0], false);
  }

  async function loadAdmin() {
    const response = await fetch("/api/admin/accounts");
    if (response.ok) setAdminData(await response.json() as AdminData);
  }

  useEffect(() => {
    fetch("/api/auth/session").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json() as { account: Account };
      setAccount(data.account);
      await loadCodes(true);
      if (data.account.role === "master") await loadAdmin();
    }).finally(() => setCheckingSession(false));
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ license }) });
      const data = await response.json() as { account?: Account; error?: string };
      if (!response.ok || !data.account) throw new Error(data.error || "No se pudo iniciar sesión");
      setAccount(data.account);
      setLicense("");
      await loadCodes(true);
      if (data.account.role === "master") await loadAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Licencia incorrecta");
    } finally { setBusy(false); }
  }

  async function logout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    setAccount(null); setCodes([]); setSaved(null); setAdminData(null); setMessage("");
  }

  const previewValue = useMemo(
    () => saved?.shortUrl || destination || DEMO_URL,
    [saved, destination],
  );

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(previewValue, {
      width: 560,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: color, light: "#FFFFFF" },
    }).then((data) => active && setQrData(data));
    return () => {
      active = false;
    };
  }, [previewValue, color]);

  function selectCode(code: SavedCode, scroll = true) {
    setSaved(code);
    setName(code.name);
    setDestination(code.destination);
    setMessage("");
    if (scroll) window.setTimeout(() => document.querySelector("#crear")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  function newCode() {
    setSaved(null);
    setName("Nuevo código QR");
    setDestination(DEMO_URL);
    setMessage("Completa los datos para crear un QR independiente.");
    window.setTimeout(() => document.querySelector("#crear")?.scrollIntoView({ behavior: "smooth" }), 0);
  }

  async function createCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/codes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, destination }),
      });
      const data = (await response.json()) as SavedCode & { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo crear el QR");
      setCodes([data, ...codes.filter((code) => code.id !== data.id)]);
      setSaved(data);
      setMessage("Código dinámico creado y guardado sin afectar los anteriores.");
      if (account?.role === "master") await loadAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  async function updateDestination() {
    if (!saved) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/codes/${saved.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ destination, name }),
      });
      const data = (await response.json()) as SavedCode & { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar");
      const updated = { ...saved, ...data };
      const next = codes.map((code) => code.id === saved.id ? updated : code);
      setSaved(updated);
      setCodes(next);
      setMessage("Destino actualizado. Los demás QR no cambiaron.");
      if (account?.role === "master") await loadAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCode(code: SavedCode) {
    if (!window.confirm(`¿Eliminar “${code.name}”? Esta acción no afecta tus otros QR.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/codes/${code.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar");
      const next = codes.filter((item) => item.id !== code.id);
      setCodes(next);
      if (saved?.id === code.id) {
        if (next[0]) selectCode(next[0]); else newCode();
      }
      setMessage("Código eliminado.");
      if (account?.role === "master") await loadAdmin();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocurrió un error");
    } finally {
      setBusy(false);
    }
  }

  function downloadQr() {
    if (!qrData) return;
    const link = document.createElement("a");
    link.download = `${name.trim().replace(/\s+/g, "-").toLowerCase() || "codigo-qr"}.png`;
    link.href = qrData;
    link.click();
  }

  async function createLicense(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setGeneratedKey("");
    try {
      const response = await fetch("/api/admin/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: licenseName, email: licenseEmail, maxQr: licenseLimit }) });
      const data = await response.json() as { key?: string; error?: string };
      if (!response.ok || !data.key) throw new Error(data.error || "No se pudo crear la licencia");
      setGeneratedKey(data.key); setLicenseName(""); setLicenseEmail(""); await loadAdmin();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Ocurrió un error"); }
    finally { setBusy(false); }
  }

  async function toggleLicense(item: AdminAccount) {
    await fetch(`/api/admin/accounts/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: item.status === "active" ? "suspended" : "active" }) });
    await loadAdmin();
  }

  async function editLicense(item: AdminAccount) {
    const newName = window.prompt("Nombre de la licencia", item.name);
    if (newName === null) return;
    const newLimit = window.prompt("Cantidad máxima de códigos QR", String(item.max_qr));
    if (newLimit === null) return;
    await fetch(`/api/admin/accounts/${item.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: newName, maxQr: Number(newLimit) }) });
    await loadAdmin();
  }

  async function removeLicense(item: AdminAccount) {
    if (!window.confirm(`¿Eliminar la licencia de “${item.name}”? Sus QR pasarán a la cuenta maestra.`)) return;
    await fetch(`/api/admin/accounts/${item.id}`, { method: "DELETE" }); await loadAdmin(); await loadCodes();
  }

  if (checkingSession) return <main className="loginPage"><div className="loginCard"><span className="eyebrow">QR DINÁMICO</span><h1>Cargando panel…</h1></div></main>;
  if (!account) return (
    <main className="loginPage">
      <form className="loginCard" onSubmit={login}>
        <span className="eyebrow">ACCESO SEGURO</span><h1>Administra tus códigos QR</h1>
        <p>Ingresa tu licencia para ver los mismos códigos desde cualquier computadora o celular.</p>
        <label htmlFor="license">Licencia de acceso</label>
        <input id="license" type="password" required value={license} onChange={(event) => setLicense(event.target.value)} placeholder="QR-XXXX-XXXX" autoComplete="current-password" />
        <button className="primaryButton" disabled={busy} type="submit">{busy ? "Ingresando…" : "Ingresar"}</button>
        {message && <p className="statusMessage" role="alert">{message}</p>}
      </form>
    </main>
  );

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="QR Dinámico, inicio">
          <span className="brandMark" aria-hidden="true"><i /><i /><i /></span>
          <span>QR Dinámico</span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#inicio">Inicio</a>
          <a href="#crear">Crear QR</a>
          <a href="#como-funciona">Cómo funciona</a>
        </nav>
        <div className="accountMenu"><span>{account.name}</span><button className="outlineButton" type="button" onClick={logout}>Salir</button></div>
      </header>

      <section className="hero" id="inicio">
        <div className="intro">
          <span className="eyebrow">QR PROFESIONAL · DESTINO EDITABLE</span>
          <h1>Crea, personaliza y administra tus códigos QR</h1>
          <p>Genera varios códigos independientes y cambia cada destino cuando quieras, sin volver a imprimirlos.</p>

          <form className="formCard" id="crear" onSubmit={createCode}>
            <label htmlFor="destination">URL de destino</label>
            <input
              id="destination"
              type="url"
              required
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="https://tusitio.com"
            />
            <div className="formRow">
              <div>
                <label htmlFor="name">Nombre del código</label>
                <input id="name" required value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div>
                <label htmlFor="color">Color del QR</label>
                <div className="colorField">
                  <input id="color" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
                  <span>{color.toUpperCase()}</span>
                </div>
              </div>
            </div>
            {!saved ? (
              <button className="primaryButton" disabled={busy} type="submit">
                {busy ? "Creando…" : "Crear código QR"}
              </button>
            ) : (
              <button className="primaryButton" disabled={busy} type="button" onClick={updateDestination}>
                {busy ? "Actualizando…" : "Actualizar este QR"}
              </button>
            )}
            <div className="secureNote"><span aria-hidden="true">↗</span> Cada código conserva su propio enlace y contador</div>
            {message && <p className="statusMessage" role="status">{message}</p>}
          </form>
        </div>

        <aside className="previewCard" aria-label="Vista previa del código QR">
          <div className="previewHeader">
            <div><span className="smallLabel">VISTA PREVIA</span><h2>{name || "Mi código QR"}</h2></div>
            <span className="activeBadge"><i /> {saved ? "Activo" : "Nuevo"}</span>
          </div>
          <div className="qrStage">
            {qrData && <img src={qrData} alt="Vista previa del código QR" />}
          </div>
          <div className="destinationBox">
            <span>Destino actual</span>
            <strong>{destination || DEMO_URL}</strong>
          </div>
          <div className="previewActions">
            <button type="button" onClick={downloadQr}>Descargar PNG</button>
            <span>{saved ? `${saved.scans} escaneos` : "Listo para crear"}</span>
          </div>
        </aside>
      </section>

      <section className="codesSection" id="mis-codigos">
        <div className="codesHeader"><div><span className="eyebrow">TU COLECCIÓN</span><h2>Mis códigos QR</h2></div><button className="secondaryButton" type="button" onClick={newCode}>+ Nuevo código</button></div>
        {codes.length ? (
          <div className="codesGrid">{codes.map((code) => (
            <article className={`codeItem ${saved?.id === code.id ? "selected" : ""}`} key={code.id}>
              <div className="codeMeta"><span>{code.scans} escaneos</span><h3>{code.name}</h3><p>{code.destination}</p></div>
              <div className="codeActions"><button type="button" onClick={() => selectCode(code)}>Editar</button><a href={code.shortUrl} target="_blank" rel="noreferrer">Abrir</a><button className="dangerButton" type="button" disabled={busy} onClick={() => deleteCode(code)}>Eliminar</button></div>
            </article>
          ))}</div>
        ) : <div className="emptyCodes"><p>Esta licencia aún no tiene códigos QR.</p><button className="primaryButton" type="button" onClick={newCode}>Crear mi primer QR</button></div>}
      </section>

      {account.role === "master" && adminData && <section className="adminSection" id="administracion">
        <div className="codesHeader"><div><span className="eyebrow">CUENTA MAESTRA</span><h2>Licencias y administración total</h2></div><span className="masterBadge">Acceso completo</span></div>
        <form className="licenseForm" onSubmit={createLicense}>
          <input required value={licenseName} onChange={(event) => setLicenseName(event.target.value)} placeholder="Nombre del cliente o licencia" />
          <input type="email" value={licenseEmail} onChange={(event) => setLicenseEmail(event.target.value)} placeholder="Correo (opcional)" />
          <input type="number" min="1" max="10000" value={licenseLimit} onChange={(event) => setLicenseLimit(Number(event.target.value))} aria-label="Límite de códigos QR" />
          <button className="primaryButton" disabled={busy} type="submit">Crear licencia</button>
        </form>
        {generatedKey && <div className="generatedKey"><span>Licencia creada — cópiala ahora:</span><strong>{generatedKey}</strong><button type="button" onClick={() => navigator.clipboard.writeText(generatedKey)}>Copiar</button></div>}
        <div className="adminTable">
          <div className="adminRow adminHead"><span>Licencia</span><span>QR</span><span>Escaneos</span><span>Estado / acciones</span></div>
          {adminData.accounts.map((item) => <div className="adminRow" key={item.id}>
            <span><strong>{item.name}</strong><small>{item.email || (item.role === "master" ? "Cuenta principal" : "Sin correo")}</small></span>
            <span>{item.qr_count} / {item.max_qr}</span><span>{item.total_scans}</span>
            <span className="adminActions"><b className={item.status}>{item.status === "active" ? "Activa" : "Suspendida"}</b>{item.role !== "master" && <><button type="button" onClick={() => editLicense(item)}>Editar</button><button type="button" onClick={() => toggleLicense(item)}>{item.status === "active" ? "Suspender" : "Activar"}</button><button className="dangerButton" type="button" onClick={() => removeLicense(item)}>Eliminar</button></>}</span>
          </div>)}
        </div>
        <h3 className="allCodesTitle">Todos los QR ({adminData.codes.length})</h3>
        <div className="codesGrid">{adminData.codes.map((code) => <article className="codeItem" key={code.id}><div className="codeMeta"><span>{code.owner_name || "Sin propietario"} · {code.scans} escaneos</span><h3>{code.name}</h3><p>{code.destination}</p></div><div className="codeActions"><button type="button" onClick={() => selectCode(code)}>Editar</button><a href={code.shortUrl} target="_blank" rel="noreferrer">Abrir</a><button className="dangerButton" type="button" onClick={() => deleteCode(code)}>Eliminar</button></div></article>)}</div>
      </section>}

      <section className="benefits" id="como-funciona" aria-label="Beneficios">
        <article><span>01</span><div><h3>Crea varios</h3><p>Cada QR tiene su propio enlace y configuración.</p></div></article>
        <article><span>02</span><div><h3>Actualiza uno</h3><p>Cambia su URL sin modificar los demás códigos.</p></div></article>
        <article><span>03</span><div><h3>Mide resultados</h3><p>Consulta cuántas veces se ha utilizado tu código.</p></div></article>
      </section>

      <footer><span>QR Dinámico</span><p>Una herramienta sencilla para enlaces que evolucionan.</p></footer>
    </main>
  );
}
