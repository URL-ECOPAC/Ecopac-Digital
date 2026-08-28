import React, { useState, useEffect } from "react";

// --- HELPER FUNCTIONS NATIVAS ---
const differenceInDays = (dateInitial, dateFinal = new Date()) => {
  if (!dateInitial) return 999;
  const d1 = new Date(dateInitial);
  const d2 = new Date(dateFinal);
  return Math.ceil((d1 - d2) / (1000 * 60 * 60 * 24));
};

const formatFecha = (fechaStr) => {
  if (!fechaStr) return "N/A";
  try {
    return new Intl.DateTimeFormat("es-GT", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(fechaStr));
  } catch {
    return "N/A";
  }
};

// --- IMPORTACIONES EXISTENTES ---
import { 
  listarMedicamentos, 
  desactivarMedicamento 
} from "../../../../packages/shared/inventario/medicamentos.api.js";

import { useCatalogoMedicamentos } from "../../../../packages/shared/inventario/useCatalogoMedicamentos.js";

// --- TARJETA DE MÉTRICAS ---
const MetricaCard = ({ dotColor, textAccentColor, label, valor, subtitulo, prefijo = "" }) => (
  <div style={{
    backgroundColor: '#ffffff',
    padding: '20px 24px',
    borderRadius: '24px',
    border: '1px solid #f1f5f9',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    flex: '1',
    minWidth: '200px'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: dotColor }}></span>
      <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', letterSpacing: '0.08em' }}>{label}</span>
    </div>
    <div style={{ fontSize: '28px', fontWeight: '800', color: textAccentColor, lineHeight: '1.2' }}>
      {prefijo}{typeof valor === 'number' ? valor.toLocaleString("es-GT") : valor}
    </div>
    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{subtitulo}</div>
  </div>
);

export default function InventarioPage() {
  const [inventarioRaw, setInventarioRaw] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const {
    busqueda,
    setBusqueda,
    categoriaSeleccionada,
    setCategoriaSeleccionada,
    bodegaSeleccionada,
    setBodegaSeleccionada,
    categoriasPills,
    inventarioFiltrado,
  } = useCatalogoMedicamentos({ inventarioInicial: inventarioRaw });

  const bodegas = ["Todas", "Central", "Norte", "Sur"];

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const resp = await listarMedicamentos();
      const datos = Array.isArray(resp) ? resp : resp?.data || [];
      setInventarioRaw(datos);
    } catch (err) {
      console.error("Error al cargar medicamentos:", err);
      setError("No se pudo cargar el inventario.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const metricas = {
    referencias: inventarioRaw.length,
    porVencer: inventarioRaw.filter(
      (i) => i.fecha_caducidad && differenceInDays(i.fecha_caducidad) <= 60 && differenceInDays(i.fecha_caducidad) > 0
    ).length,
    sinStock: inventarioRaw.filter((i) => (i.stock || 0) <= 0).length,
    valorTotal: inventarioRaw.reduce((sum, i) => sum + (i.p_unitario || 0) * (i.stock || 0), 0),
  };

  // Ítems para la sección de Alertas (menores o iguales a 60 días)
  const itemsAlertas = inventarioRaw
    .filter((i) => i.fecha_caducidad && differenceInDays(i.fecha_caducidad) <= 60 && differenceInDays(i.fecha_caducidad) > 0)
    .sort((a, b) => differenceInDays(a.fecha_caducidad) - differenceInDays(b.fecha_caducidad));

  const getEstadoStock = (item) => {
    const dias = differenceInDays(item.fecha_caducidad);
    
    if ((item.stock || 0) <= 0) 
      return { label: "AGOTADO", bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' };
    if (item.stock < (item.stock_critico || 10)) 
      return { label: "CRÍTICO", bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' };
    if (dias <= 30 && dias > 0)
      return { label: "POR VENCER", bg: '#fffbeb', color: '#d97706', border: '#fef3c7' };
    if (dias <= 0)
      return { label: "VENCIDO", bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' };

    return { label: "DISPONIBLE", bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Encabezado */}
      <div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#1e293b', margin: 0 }}>Control de Inventario</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
          Trazabilidad multi-bodega • Lote y serie • Alertas de caducidad
        </p>
      </div>

      {cargando && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #f1f5f9' }}>
          Cargando inventario...
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', color: '#dc2626', backgroundColor: '#fef2f2', borderRadius: '16px', border: '1px solid #fee2e2', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {!cargando && !error && (
        <>
          {/* Fila de Tarjetas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <MetricaCard
              label="REFERENCIAS"
              dotColor="#10b981"
              textAccentColor="#10b981"
              valor={metricas.referencias}
              subtitulo="en catálogo"
            />
            <MetricaCard
              label="POR VENCER"
              dotColor="#f59e0b"
              textAccentColor="#f59e0b"
              valor={metricas.porVencer}
              subtitulo="≤ 60 días"
            />
            <MetricaCard
              label="SIN STOCK"
              dotColor="#ec4899"
              textAccentColor="#ec4899"
              valor={metricas.sinStock}
              subtitulo="agotados"
            />
            <MetricaCard
              label="VALOR INVENTARIO"
              dotColor="#06b6d4"
              textAccentColor="#06b6d4"
              valor={metricas.valorTotal}
              subtitulo="stock actual"
              prefijo="Q "
            />
          </div>

          {/* SECCIÓN ALERTAS DE CADUCIDAD (Estilo Figma) */}
          {itemsAlertas.length > 0 && (
            <div style={{
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '24px',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></span>
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#d97706', letterSpacing: '0.08em' }}>
                  ALERTAS DE CADUCIDAD
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {itemsAlertas.map((item) => {
                  const dias = differenceInDays(item.fecha_caducidad);
                  const esUrgente = dias <= 15;
                  const colorAcray = esUrgente ? '#e11d48' : '#d97706';

                  return (
                    <div
                      key={item.id}
                      style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '16px',
                        padding: '14px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Izquierda: Indicador visual + Datos medicamento */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                          width: '4px',
                          height: '32px',
                          borderRadius: '9999px',
                          backgroundColor: colorAcray
                        }} />
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                            {item.nombre}
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px', fontFamily: 'monospace' }}>
                            {item.codigo || 'FAR-0000'} • Lote {item.lote || 'N/A'}
                          </div>
                        </div>
                      </div>

                      {/* Derecha: Bodega + Días y fecha */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          letterSpacing: '0.05em',
                          color: item.bodega === "SUR" ? "#f59e0b" : item.bodega === "NORTE" ? "#0ea5e9" : "#10b981"
                        }}>
                          {item.bodega || 'CENTRAL'}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: colorAcray }}>
                            {dias}d
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                            {formatFecha(item.fecha_caducidad)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* BARRA DE BÚSQUEDA Y SELECTOR DE BODEGAS */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              position: 'relative',
              flex: '1',
              minWidth: '280px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <span style={{
                position: 'absolute',
                left: '16px',
                color: '#94a3b8',
                fontSize: '14px',
                pointerEvents: 'none'
              }}>
                🔍
              </span>
              <input
                type="text"
                placeholder="Código, descripción o lote..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 16px 10px 42px',
                  borderRadius: '9999px',
                  border: '1px solid #e2e8f0',
                  backgroundColor: '#ffffff',
                  fontSize: '13px',
                  color: '#334155',
                  outline: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              />
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '9999px',
              padding: '3px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}>
              {bodegas.map((bod) => {
                const esSeleccionado = bodegaSeleccionada === bod || (bod === "Todas" && !bodegaSeleccionada);
                return (
                  <button
                    key={bod}
                    onClick={() => setBodegaSeleccionada(bod === "Todas" ? "" : bod)}
                    style={{
                      padding: '6px 18px',
                      borderRadius: '9999px',
                      fontSize: '12px',
                      fontWeight: '600',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      backgroundColor: esSeleccionado ? '#e8f5e9' : 'transparent',
                      color: esSeleccionado ? '#2e7d32' : '#64748b'
                    }}
                  >
                    {bod}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtros de Categorías */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {categoriasPills.map((cat) => {
              const esSeleccionado = categoriaSeleccionada === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaSeleccionada(cat)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '9999px',
                    fontSize: '12px',
                    fontWeight: '600',
                    border: '1px solid',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    backgroundColor: esSeleccionado ? '#ecfdf5' : '#ffffff',
                    color: esSeleccionado ? '#047857' : '#64748b',
                    borderColor: esSeleccionado ? '#a7f3d0' : '#e2e8f0'
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Tabla de Inventario */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '24px', border: '1px solid #f1f5f9', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ffffff' }}>
                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CÓDIGO</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DESCRIPCIÓN</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CATEGORÍA</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LOTE / SERIE</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BODEGA</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>CADUCIDAD</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STOCK</th>
                    <th style={{ padding: '16px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>P. UNIT.</th>
                    <th style={{ padding: '16px 20px', fontSize: '10px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>ESTADO</th>
                  </tr>
                </thead>
                <tbody>
                  {inventarioFiltrado.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                        No hay referencias registradas en esta vista.
                      </td>
                    </tr>
                  ) : (
                    inventarioFiltrado.map((item) => {
                      const estado = getEstadoStock(item);
                      const diasCaducidad = differenceInDays(item.fecha_caducidad);
                      
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '16px 20px', color: '#10b981', fontWeight: '600', fontFamily: 'monospace' }}>
                            {item.codigo || 'FAR-0000'}
                          </td>
                          <td style={{ padding: '16px', color: '#1e293b', fontWeight: '700' }}>
                            {item.nombre}
                          </td>
                          <td style={{ padding: '16px', color: '#94a3b8', textTransform: 'capitalize' }}>
                            {item.categoria || 'Medicamentos'}
                          </td>
                          <td style={{ padding: '16px', color: '#0ea5e9', fontFamily: 'monospace' }}>
                            {item.lote || 'L-2024-0000'}
                          </td>
                          <td style={{ padding: '16px', fontWeight: '700', fontSize: '11px' }}>
                            <span style={{
                              color: item.bodega === "NORTE" ? "#0ea5e9" : item.bodega === "SUR" ? "#f59e0b" : "#10b981"
                            }}>
                              {item.bodega || 'CENTRAL'}
                            </span>
                          </td>
                          <td style={{ padding: '16px', color: '#64748b' }}>
                            {item.fecha_caducidad ? (
                              <div>
                                <div style={{ color: diasCaducidad <= 30 ? '#f59e0b' : '#64748b', fontWeight: diasCaducidad <= 30 ? '600' : 'normal' }}>
                                  {formatFecha(item.fecha_caducidad)}
                                </div>
                                {diasCaducidad <= 60 && (
                                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>en {diasCaducidad}d</div>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: '#cbd5e1' }}>N/A</span>
                            )}
                          </td>
                          <td style={{ padding: '16px' }}>
                            <strong style={{ color: '#1e293b', fontSize: '14px' }}>{item.stock ?? 0}</strong>{' '}
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>{item.unidad_medida || "Cajas"}</span>
                          </td>
                          <td style={{ padding: '16px', color: '#64748b' }}>
                            Q {item.p_unitario?.toLocaleString('es-GT') || '0'}
                          </td>
                          <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <span style={{
                              display: 'inline-block',
                              padding: '4px 12px',
                              borderRadius: '9999px',
                              fontSize: '10px',
                              fontWeight: '700',
                              letterSpacing: '0.05em',
                              backgroundColor: estado.bg,
                              color: estado.color,
                              border: `1px solid ${estado.border}`
                            }}>
                              {estado.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pie de tabla */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#94a3b8', backgroundColor: '#fafafa' }}>
              <div>{inventarioFiltrado.length} de {inventarioRaw.length} referencias</div>
              <div>Valor: <strong style={{ color: '#1e293b' }}>Q {metricas.valorTotal.toLocaleString("es-GT")}</strong></div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}