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
  token: string;
};

type Access = { id: string; token: string };\n\nconst DEMO_URL = "https://tusitio.com";\nconst ACCESS_LIST_KEY = "qr-dinamico-accesses";\nconst LEGACY_ACCESS_KEY = "qr-dinamico-access";

export default function Home() {
  const [destination, setDestination] = useState(DEMO_URL);
  const [name, setName] = useState("Campaña principal");
  const [color, setColor] = useState("#0B1F3A");
  const [qrData, setQrData] = useState("");
  const [saved, setSaved] = useState<SavedCode | null>(null);\n  const [codes, setCodes] = useState<SavedCode[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const access = window.localStorage.getItem("qr-dinamico-access");
    if (!access) return;
    const stored = JSON.parse(access) as { id: string; token: string };
    fetch(`/api/codes/${stored.id}?token=${encodeURIComponent(stored.token)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((code: SavedCode | null) => {
        if (!code) return;
        setSaved({ ...code, token: stored.token });
        setName(code.name);
        setDestination(code.destination);
      })
      .catch(() => window.localStorage.removeItem("qr-dinamico-access"));
  }, []);

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
      const next = [data, ...codes.filter((code) => code.id !== data.id)];
      setCodes(next);
      setSaved(data);
      saveAccesses(next);
      window.localStorage.removeItem(LEGACY_ACCESS_KEY);
      setMessage("Código dinámico creado y guardado sin afectar los anteriores.");
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
        body: JSON.stringify({ destination, name, token: saved.token }),
      });
      const data = (await response.json()) as SavedCode & { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo actualizar");
      const updated = { ...saved, ...data, token: saved.token };
      const next = codes.map((code) => code.id === saved.id ? updated : code);
      setSaved(updated);
      setCodes(next);
      saveAccesses(next);
      setMessage("Destino actualizado. Los demás QR no cambiaron.");
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
      const response = await fetch(`/api/codes/${code.id}?token=${encodeURIComponent(code.token)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar");
      const next = codes.filter((item) => item.id !== code.id);
      setCodes(next);
      saveAccesses(next);
      if (saved?.id === code.id) {
        if (next[0]) selectCode(next[0]); else newCode();
      }
      setMessage("Código eliminado.");
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
        <button className="outlineButton" type="button" onClick={newCode}>Nuevo código</button>
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
        ) : <div className="emptyCodes"><p>Aún no tienes códigos guardados en este navegador.</p><button className="primaryButton" type="button" onClick={newCode}>Crear mi primer QR</button></div>}
      </section>

      <section className="benefits" id="como-funciona" aria-label="Beneficios">
        <article><span>01</span><div><h3>Crea varios</h3><p>Cada QR tiene su propio enlace y configuración.</p></div></article>
        <article><span>02</span><div><h3>Actualiza uno</h3><p>Cambia su URL sin modificar los demás códigos.</p></div></article>
        <article><span>03</span><div><h3>Mide resultados</h3><p>Consulta cuántas veces se ha utilizado tu código.</p></div></article>
      </section>

      <footer><span>QR Dinámico</span><p>Una herramienta sencilla para enlaces que evolucionan.</p></footer>
    </main>
  );
}
