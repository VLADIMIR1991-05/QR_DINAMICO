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

const DEMO_URL = "https://tusitio.com";

export default function Home() {
  const [destination, setDestination] = useState(DEMO_URL);
  const [name, setName] = useState("Campaña principal");
  const [color, setColor] = useState("#0B1F3A");
  const [qrData, setQrData] = useState("");
  const [saved, setSaved] = useState<SavedCode | null>(null);
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
      setSaved(data);
      window.localStorage.setItem("qr-dinamico-access", JSON.stringify({ id: data.id, token: data.token }));
      setMessage("Código dinámico creado y guardado.");
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
      setSaved({ ...saved, ...data });
      setMessage("Destino actualizado. El QR sigue siendo el mismo.");
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
        <a className="outlineButton" href="#crear">Nuevo código</a>
      </header>

      <section className="hero" id="inicio">
        <div className="intro">
          <span className="eyebrow">QR PROFESIONAL · DESTINO EDITABLE</span>
          <h1>Crea, personaliza y administra tus códigos QR</h1>
          <p>Genera un código una sola vez y cambia su destino cuando quieras, sin volver a imprimirlo.</p>

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
                {busy ? "Actualizando…" : "Actualizar destino"}
              </button>
            )}
            <div className="secureNote"><span aria-hidden="true">↗</span> Destino editable en cualquier momento</div>
            {message && <p className="statusMessage" role="status">{message}</p>}
          </form>
        </div>

        <aside className="previewCard" aria-label="Vista previa del código QR">
          <div className="previewHeader">
            <div><span className="smallLabel">VISTA PREVIA</span><h2>{name || "Mi código QR"}</h2></div>
            <span className="activeBadge"><i /> Activo</span>
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

      <section className="benefits" id="como-funciona" aria-label="Beneficios">
        <article><span>01</span><div><h3>Crea una vez</h3><p>Obtén un QR de alta calidad listo para descargar.</p></div></article>
        <article><span>02</span><div><h3>Actualiza el destino</h3><p>Cambia la URL sin reemplazar el código impreso.</p></div></article>
        <article><span>03</span><div><h3>Mide resultados</h3><p>Consulta cuántas veces se ha utilizado tu código.</p></div></article>
      </section>

      <footer><span>QR Dinámico</span><p>Una herramienta sencilla para enlaces que evolucionan.</p></footer>
    </main>
  );
}
