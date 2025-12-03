import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useRef,
  useEffect,
} from "react";
import {
  ArrowLeft,
  X,
  Eye,
  Download,
  Share2,
  Trash2,
} from "lucide-react";
import html2canvas from "html2canvas";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";
import "./QuoteSheetHome.css";

interface QuoteSheetHomeProps {
  onBack: () => void;
  onOpenSavedSheets?: () => void;
  onEditFixedData?: () => void;
  onNewQuoteSheet?: () => void;
}

interface FixedDataFormState {
  companyName: string;
  locality: string;
  postalCode: string;
  street: string;
  streetNumber: string;
  phone: string;
  logoPreview?: string | null;
}

interface QuoteFormState {
  date: string;
  client: string;
  pieces: string[];
  total: string;
}

interface SavedQuote {
  id: number;
  date: string;
  client: string;
  pieces: string[];
  total: string;
}

const PIECES_PER_PAGE = 14;

const QuoteSheetHome: React.FC<QuoteSheetHomeProps> = ({
  onBack,
  onOpenSavedSheets,
  onEditFixedData,
  onNewQuoteSheet,
}) => {
  // Modales
  const [showFixedDataModal, setShowFixedDataModal] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Datos fijos
  const [fixedData, setFixedData] = useState<FixedDataFormState>({
    companyName: "",
    locality: "",
    postalCode: "",
    street: "",
    streetNumber: "",
    phone: "",
    logoPreview: null,
  });

  // Formulario de nueva hoja
  const [quoteData, setQuoteData] = useState<QuoteFormState>({
    date: "",
    client: "",
    pieces: [""],
    total: "",
  });

  // Cotizaciones guardadas
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);

  // Vista previa
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);

  // Exportar (descargar / compartir)
  const [quoteForExport, setQuoteForExport] = useState<SavedQuote | null>(
    null
  );
  const [exportAction, setExportAction] = useState<
    "download" | "share" | null
  >(null);

  // Modo especial para que la hoja ocupe TODO el tamaño carta al exportar
  const [exportMode, setExportMode] = useState(false);

  const exportContainerRef = useRef<HTMLDivElement | null>(null);

  // ─────────────────────────────────────────────
  // Topbar
  // ─────────────────────────────────────────────

  const handleFixedDataClick = () => {
    setShowFixedDataModal(true);
    if (onEditFixedData) onEditFixedData();
  };

  const handleNewQuoteClick = () => {
    setShowQuoteModal(true);
    if (onNewQuoteSheet) onNewQuoteSheet();
  };

  // ─────────────────────────────────────────────
  // Datos fijos
  // ─────────────────────────────────────────────

  const handleFixedInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFixedData((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFixedData((prev) => ({
        ...prev,
        logoPreview:
          typeof reader.result === "string" ? reader.result : null,
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleFixedDataSubmit = (e: FormEvent) => {
    e.preventDefault();
    console.log("[Hoja] Datos fijos guardados:", fixedData);
    setShowFixedDataModal(false);
  };

  // ─────────────────────────────────────────────
  // Nueva hoja de cotización
  // ─────────────────────────────────────────────

  const handleQuoteInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setQuoteData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePieceChange = (index: number, value: string) => {
    setQuoteData((prev) => {
      const nextPieces = [...prev.pieces];
      nextPieces[index] = value;
      return { ...prev, pieces: nextPieces };
    });
  };

  const handleAddPiece = () => {
    setQuoteData((prev) => ({
      ...prev,
      pieces: [...prev.pieces, ""],
    }));
  };

  const handleQuoteSubmit = (e: FormEvent) => {
    e.preventDefault();

    const newQuote: SavedQuote = {
      id: Date.now(),
      date: quoteData.date,
      client: quoteData.client,
      pieces: [...quoteData.pieces],
      total: quoteData.total,
    };

    setSavedQuotes((prev) => [newQuote, ...prev]);
    console.log("[Hoja] Cotización guardada:", newQuote);

    setShowQuoteModal(false);
    setQuoteData({
      date: "",
      client: "",
      pieces: [""],
      total: "",
    });
  };

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  const formatDate = (value: string) => {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTotal = (value: string) => {
    if (!value) return "0";
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    return num.toLocaleString("es-MX", { minimumFractionDigits: 0 });
  };

  // ─────────────────────────────────────────────
  // Acciones tarjeta
  // ─────────────────────────────────────────────

  const handleViewQuote = (q: SavedQuote) => {
    setPreviewQuote(q);
  };

  const handleDownloadQuote = (q: SavedQuote) => {
    const ok = window.confirm(
      "¿Estás seguro que quieres descargar esta cotización?"
    );
    if (!ok) return;
    setQuoteForExport(q);
    setExportAction("download");
    setExportMode(true);
  };

  const handleShareQuote = (q: SavedQuote) => {
    const ok = window.confirm(
      "¿Quieres compartir esta cotización como imagen JPG?"
    );
    if (!ok) return;
    setQuoteForExport(q);
    setExportAction("share");
    setExportMode(true);
  };

  const handleDeleteQuote = (q: SavedQuote) => {
    const ok = window.confirm(
      "¿Estás seguro de eliminar esta cotización?"
    );
    if (!ok) return;
    setSavedQuotes((prev) => prev.filter((item) => item.id !== q.id));
  };

  // ─────────────────────────────────────────────
  // Renderizar páginas
  // ─────────────────────────────────────────────

  const renderQuotePages = (quote: SavedQuote) => {
    const pieces = quote.pieces
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const totalPages = Math.max(
      1,
      Math.ceil(pieces.length / PIECES_PER_PAGE)
    );

    return Array.from({ length: totalPages }).map((_, pageIndex) => {
      const start = pageIndex * PIECES_PER_PAGE;
      const end = start + PIECES_PER_PAGE;
      const pagePieces = pieces.slice(start, end);
      const showTotalOnThisPage = pageIndex === 0;

      return (
        <div key={pageIndex} className="qsh-preview-page">
          {/* Cabecera azul */}
          <div className="qsh-sheet-header">
            <div className="qsh-sheet-logo">
              {fixedData.logoPreview ? (
                <img
                  src={fixedData.logoPreview}
                  alt="Logo"
                  className="qsh-sheet-logo-img"
                />
              ) : (
                <div className="qsh-sheet-logo-placeholder">
                  LOGO
                </div>
              )}
            </div>

            <div className="qsh-sheet-header-main">
              <div className="qsh-sheet-company">
                {fixedData.companyName || "Nombre de tu empresa"}
              </div>
              <div className="qsh-sheet-subtitle">Hoja de cotización</div>

              <div className="qsh-sheet-header-bottom">
                <div className="qsh-sheet-header-left">
                  <div>{fixedData.locality || "Tu localidad..."}</div>
                  <div>
                    {fixedData.postalCode
                      ? `CP: ${fixedData.postalCode}`
                      : ""}
                  </div>
                  <div>
                    {(fixedData.street || "Tu calle") +
                      (fixedData.streetNumber
                        ? ` , ${fixedData.streetNumber}`
                        : "")}
                  </div>
                  <div>
                    Teléfono: {fixedData.phone || "Tu teléfono"}
                  </div>
                </div>

                <div className="qsh-sheet-header-right">
                  <div className="qsh-sheet-header-right-row">
                    Fecha: {formatDate(quote.date)}
                  </div>
                  <div className="qsh-sheet-header-right-row">
                    Cliente: {quote.client || "Nombre del cliente"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Cuerpo */}
          <div className="qsh-sheet-body">
            <div className="qsh-sheet-details-title">
              Detalles de cotización:
            </div>

            <div className="qsh-sheet-table">
              <div className="qsh-sheet-table-header">
                <div className="qsh-sheet-table-col piezas">Piezas</div>
                <div className="qsh-sheet-table-col total">Total</div>
              </div>

              <div className="qsh-sheet-table-body">
                <div className="qsh-sheet-pieces-list">
                  {pagePieces.map((p, idx) => (
                    <div key={idx}>{p}</div>
                  ))}
                </div>

                <div className="qsh-sheet-total-value">
                  {showTotalOnThisPage ? formatTotal(quote.total) : ""}
                </div>
              </div>
            </div>

            <div className="qsh-sheet-footer">
              <span>Cotizado desde AL Calculadora</span>
              <span>
                Pág. {pageIndex + 1} de {totalPages}
              </span>
            </div>
          </div>
        </div>
      );
    });
  };

  // ─────────────────────────────────────────────
  // Exportar a JPG / compartir (tamaño carta lleno)
  // ─────────────────────────────────────────────

  useEffect(() => {
    const runExport = async () => {
      if (!quoteForExport || !exportAction || !exportMode) return;
      const container = exportContainerRef.current;
      if (!container) return;

      const pageElements = Array.from(
        container.querySelectorAll<HTMLElement>(".qsh-preview-page")
      );
      if (pageElements.length === 0) return;

      try {
        const images: string[] = [];

        for (const pageEl of pageElements) {
          // Tomamos exactamente el tamaño del elemento (que en modo export
          // ya es 2550x3300, tamaño carta)
          const canvas = await html2canvas(pageEl, {
            backgroundColor: "#ffffff",
            useCORS: true,
            scale: 1.5, // un poquito más de resolución sin cambiar proporción
            scrollX: 0,
            scrollY: 0,
          });

          const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
          images.push(dataUrl);
        }

        if (exportAction === "download") {
          images.forEach((dataUrl, index) => {
            const a = document.createElement("a");
            const pageNumber = index + 1;
            const safeClient =
              quoteForExport.client?.trim().replace(/\s+/g, "_") ||
              "cotizacion";
            a.href = dataUrl;
            a.download = `${safeClient}-pag-${pageNumber}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          });
        } else if (exportAction === "share") {
          const can = await Share.canShare();
          if (can.value) {
            const fileUris: string[] = [];

            for (let i = 0; i < images.length; i++) {
              const base64Data = images[i].split(",")[1];
              const safeClient =
                quoteForExport.client
                  ?.trim()
                  .replace(/\s+/g, "_") || "cotizacion";
              const fileName = `${safeClient}-pag-${i + 1}.jpg`;

              await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: Directory.Cache,
              });

              const uriResult = await Filesystem.getUri({
                path: fileName,
                directory: Directory.Cache,
              });

              fileUris.push(uriResult.uri);
            }

            await Share.share({
              title: "Hoja de cotización",
              text: `Cotización de ${quoteForExport.client || ""}`,
              files: fileUris,
              dialogTitle: "Compartir cotización",
            });
          } else {
            window.open(images[0], "_blank");
          }
        }
      } catch (err) {
        console.error("[Hoja] Error al exportar la cotización:", err);
      } finally {
        setExportAction(null);
        setQuoteForExport(null);
        setExportMode(false);
      }
    };

    runExport();
  }, [quoteForExport, exportAction, exportMode]);

  // ─────────────────────────────────────────────
  // Render principal
  // ─────────────────────────────────────────────

  return (
    <div className="quote-sheet-home">
      {/* Barra superior */}
      <div className="quote-sheet-home__topbar">
        <button className="qsh-topbar-btn" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>

        <button
          className="qsh-topbar-fixed-data"
          onClick={handleFixedDataClick}
        >
          + Tus datos
        </button>
      </div>

      {/* Contenido blanco */}
      <div className="quote-sheet-home__content">
        {savedQuotes.length === 0 ? (
          <div className="qsh-empty">
            <button
              className="qsh-new-quote-btn"
              onClick={handleNewQuoteClick}
            >
              + Nueva hoja de cotizacion
            </button>
          </div>
        ) : (
          <>
            <div className="qsh-list">
              {savedQuotes.map((q) => (
                <div key={q.id} className="qsh-quote-card">
                  <div className="qsh-quote-main">
                    <div className="qsh-quote-client">
                      {q.client || "Sin nombre"}
                    </div>
                    <div className="qsh-quote-meta">
                      <span>{formatDate(q.date)}</span>
                      <span className="qsh-quote-total">
                        TOTAL: {formatTotal(q.total)}
                      </span>
                    </div>
                  </div>

                  <div className="qsh-quote-actions">
                    <button
                      className="qsh-quote-action-btn"
                      onClick={() => handleViewQuote(q)}
                      aria-label="Ver hoja de cotización"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      className="qsh-quote-action-btn"
                      onClick={() => handleDownloadQuote(q)}
                      aria-label="Descargar hoja de cotización"
                    >
                      <Download size={16} />
                    </button>
                    <button
                      className="qsh-quote-action-btn"
                      onClick={() => handleShareQuote(q)}
                      aria-label="Compartir hoja de cotización"
                    >
                      <Share2 size={16} />
                    </button>
                    <button
                      className="qsh-quote-action-btn qsh-quote-action-btn--danger"
                      onClick={() => handleDeleteQuote(q)}
                      aria-label="Eliminar hoja de cotización"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="qsh-new-quote-wrapper">
              <button
                className="qsh-new-quote-btn"
                onClick={handleNewQuoteClick}
              >
                + Nueva hoja de cotizacion
              </button>
            </div>
          </>
        )}
      </div>

      {/* Barra inferior */}
      <div className="quote-sheet-home__bottombar" />

      {/* Contenedor oculto para exportar */}
      <div
        ref={exportContainerRef}
        className={
          exportMode
            ? "qsh-export-container qsh-export-mode"
            : "qsh-export-container"
        }
        aria-hidden="true"
      >
        {quoteForExport && renderQuotePages(quoteForExport)}
      </div>

      {/* Modal: Tus datos */}
      {showFixedDataModal && (
        <div className="qsh-modal-overlay">
          <div className="qsh-modal">
            <div className="qsh-modal-header">
              <h2 className="qsh-modal-title">Tus datos</h2>
              <button
                className="qsh-modal-close"
                onClick={() => setShowFixedDataModal(false)}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFixedDataSubmit} className="qsh-modal-body">
              <div className="qsh-field">
                <label className="qsh-label">Nombre de la empresa</label>
                <input
                  type="text"
                  name="companyName"
                  value={fixedData.companyName}
                  onChange={handleFixedInputChange}
                  className="qsh-input"
                />
              </div>

              <div className="qsh-two-columns">
                <div className="qsh-field">
                  <label className="qsh-label">Localidad</label>
                  <input
                    type="text"
                    name="locality"
                    value={fixedData.locality}
                    onChange={handleFixedInputChange}
                    className="qsh-input"
                  />
                </div>
                <div className="qsh-field">
                  <label className="qsh-label">C.P.</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={fixedData.postalCode}
                    onChange={handleFixedInputChange}
                    className="qsh-input"
                  />
                </div>
              </div>

              <div className="qsh-two-columns">
                <div className="qsh-field">
                  <label className="qsh-label">Calle</label>
                  <input
                    type="text"
                    name="street"
                    value={fixedData.street}
                    onChange={handleFixedInputChange}
                    className="qsh-input"
                  />
                </div>
                <div className="qsh-field">
                  <label className="qsh-label">No.</label>
                  <input
                    type="text"
                    name="streetNumber"
                    value={fixedData.streetNumber}
                    onChange={handleFixedInputChange}
                    className="qsh-input"
                  />
                </div>
              </div>

              <div className="qsh-field">
                <label className="qsh-label">Teléfono</label>
                <input
                  type="tel"
                  name="phone"
                  value={fixedData.phone}
                  onChange={handleFixedInputChange}
                  className="qsh-input"
                />
              </div>

              <div className="qsh-field">
                <label className="qsh-label">
                  Logo (recomendado aprox. 300x300 px)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                />
                {fixedData.logoPreview && (
                  <div className="qsh-logo-preview-wrapper">
                    <img
                      src={fixedData.logoPreview}
                      alt="Vista previa del logo"
                      className="qsh-logo-preview"
                    />
                  </div>
                )}
              </div>

              <div className="qsh-modal-actions">
                <button
                  type="button"
                  className="qsh-btn-ghost"
                  onClick={() => setShowFixedDataModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="qsh-btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nueva hoja de cotización */}
      {showQuoteModal && (
        <div className="qsh-modal-overlay">
          <div className="qsh-modal">
            <div className="qsh-modal-header">
              <h2 className="qsh-modal-title">Nueva hoja de cotización</h2>
              <button
                className="qsh-modal-close"
                onClick={() => setShowQuoteModal(false)}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuoteSubmit} className="qsh-modal-body">
              <div className="qsh-two-columns">
                <div className="qsh-field">
                  <label className="qsh-label">Fecha</label>
                  <input
                    type="date"
                    name="date"
                    value={quoteData.date}
                    onChange={handleQuoteInputChange}
                    className="qsh-input"
                  />
                </div>
                <div className="qsh-field">
                  <label className="qsh-label">Cliente</label>
                  <input
                    type="text"
                    name="client"
                    value={quoteData.client}
                    onChange={handleQuoteInputChange}
                    className="qsh-input"
                  />
                </div>
              </div>

              <div className="qsh-field">
                <label className="qsh-label">
                  Piezas (agrega una por línea)
                </label>
                {quoteData.pieces.map((piece, index) => (
                  <input
                    key={index}
                    type="text"
                    value={piece}
                    onChange={(e) =>
                      handlePieceChange(index, e.target.value)
                    }
                    className="qsh-input qsh-piece-input"
                    placeholder={`Pieza ${index + 1}`}
                  />
                ))}
                <button
                  type="button"
                  className="qsh-btn-secondary"
                  onClick={handleAddPiece}
                >
                  + Agregar pieza
                </button>
              </div>

              <div className="qsh-field">
                <label className="qsh-label">Total</label>
                <input
                  type="number"
                  name="total"
                  value={quoteData.total}
                  onChange={handleQuoteInputChange}
                  className="qsh-input"
                />
              </div>

              <div className="qsh-modal-actions">
                <button
                  type="button"
                  className="qsh-btn-ghost"
                  onClick={() => setShowQuoteModal(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="qsh-btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pantalla de vista previa */}
      {previewQuote && (
        <div className="qsh-preview-overlay">
          <div className="qsh-preview">
            <div className="qsh-preview-topbar">
              <button
                className="qsh-topbar-btn"
                onClick={() => setPreviewQuote(null)}
              >
                <ArrowLeft size={20} />
              </button>
            </div>

            <div className="qsh-preview-content">
              <h1 className="qsh-preview-heading">
                Vista previa de la cotización
              </h1>

              {renderQuotePages(previewQuote)}
            </div>

            <div className="qsh-preview-bottombar" />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuoteSheetHome;
