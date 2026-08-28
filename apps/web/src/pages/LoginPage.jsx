import React, { useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { ESTADOS_DE_RESTAURACION, useInicioSesion } from '@ecopac/shared';
import { useSesionCompartida } from '../contexto/SesionProvider';

export default function LoginPage() {
  const location = useLocation();
  const { estadoRestauracion, haySesion } = useSesionCompartida();
  const rutaPrevia = location.state?.from?.pathname;

  const {
    correo, setCorreo,
    contrasena, setContrasena,
    erroresDeCampo: erroresDelHook,
    error: errorDelHook,
    enviando,
    handleSubmit: ejecutarLogin,
    destinoPorDefecto,
  } = useInicioSesion({ rutaPrevia });

  const [verPassword, setVerPassword] = useState(false);
  const [erroresLocales, setErroresLocales] = useState({});

  if (estadoRestauracion === ESTADOS_DE_RESTAURACION.CARGANDO) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', color: '#16A34A', fontFamily: 'sans-serif' }}>
        Cargando EcoPac...
      </div>
    );
  }

  if (haySesion) {
    return <Navigate to={destinoPorDefecto || '/'} replace />;
  }

  const errores = { ...erroresDelHook, ...erroresLocales };

  const ManejarEnvioFormulario = (e) => {
    e.preventDefault();
    const nuevosErrores = {};
    if (!correo?.trim()) nuevosErrores.correo = 'El correo electrónico es requerido.';
    if (!contrasena) nuevosErrores.contrasena = 'La contraseña es requerida.';
    
    if (Object.keys(nuevosErrores).length) {
      setErroresLocales(nuevosErrores);
      return;
    }

    setErroresLocales({});
    ejecutarLogin(e);
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#EFF6FF',
      backgroundImage: 'linear-gradient(135deg, #F0FDF4 0%, #E0F2FE 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center', // CORREGIDO: antes decía justify: 'center'
      padding: '20px 16px',
      boxSizing: 'border-box',
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      
      {/* Tarjeta Flotante Centrada y Responsive */}
      <div style={{
        width: '100%',
        maxWidth: '380px',
        margin: '0 auto', // Garantiza centrado horizontal
        backgroundColor: '#FFFFFF',
        borderRadius: '24px',
        padding: '36px 28px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
        border: '1px solid #E2E8F0',
        boxSizing: 'border-box'
      }}>
        
        {/* Encabezado e Identidad EcoPac */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          
          {/* Isotipo con los 4 colores de marca */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', width: '28px', height: '28px' }}>
              <span style={{ backgroundColor: '#22C55E', borderRadius: '50%', width: '12px', height: '12px' }}></span>
              <span style={{ backgroundColor: '#3B82F6', borderRadius: '50%', width: '12px', height: '12px' }}></span>
              <span style={{ backgroundColor: '#F59E0B', borderRadius: '50%', width: '12px', height: '12px' }}></span>
              <span style={{ backgroundColor: '#EC4899', borderRadius: '50%', width: '12px', height: '12px' }}></span>
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ display: 'block', fontSize: '22px', fontWeight: '800', color: '#1E293B', lineHeight: '1' }}>EcoPac</span>
              <span style={{ display: 'block', fontSize: '9px', fontWeight: '700', letterSpacing: '1px', color: '#64748B', textTransform: 'uppercase', marginTop: '2px' }}>Jornadas Médicas</span>
            </div>
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#0F172A', margin: '14px 0 4px 0' }}>
            Iniciar sesión
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '0' }}>
            Ingresa a la plataforma de gestión
          </p>
        </div>

        {/* Error General del Servidor */}
        {errorDelHook && (
          <div style={{
            marginBottom: '16px',
            padding: '10px 14px',
            borderRadius: '12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FEE2E2',
            color: '#DC2626',
            fontSize: '12px',
            textAlign: 'center',
            fontWeight: '500'
          }}>
            {errorDelHook.mensaje || errorDelHook}
          </div>
        )}

        <form onSubmit={ManejarEnvioFormulario} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Campo Correo */}
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', width: '100%' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Correo electrónico
            </label>
            <input
              type="email"
              autoComplete="username"
              placeholder="ej. usuario@ecopac.org"
              value={correo}
              onChange={(e) => {
                setCorreo(e.target.value);
                if (erroresLocales.correo) setErroresLocales(p => ({ ...p, correo: null }));
              }}
              disabled={enviando}
              style={{
                width: '100%',
                display: 'block',
                padding: '11px 14px',
                fontSize: '14px',
                backgroundColor: '#F8FAFC',
                border: (errores?.correo || errores?.email) ? '1px solid #EF4444' : '1px solid #CBD5E1',
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                color: '#0F172A',
                transition: 'all 0.2s ease'
              }}
            />
            {(errores?.correo || errores?.email) && (
              <span style={{ fontSize: '11px', fontWeight: '500', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                {errores?.correo || errores?.email}
              </span>
            )}
          </div>

          {/* Campo Contraseña */}
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', width: '100%' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={verPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={contrasena}
                onChange={(e) => {
                  setContrasena(e.target.value);
                  if (erroresLocales.contrasena) setErroresLocales(p => ({ ...p, contrasena: null }));
                }}
                disabled={enviando}
                style={{
                  width: '100%',
                  display: 'block',
                  padding: '11px 65px 11px 14px',
                  fontSize: '14px',
                  backgroundColor: '#F8FAFC',
                  border: errores?.contrasena ? '1px solid #EF4444' : '1px solid #CBD5E1',
                  borderRadius: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  color: '#0F172A',
                  transition: 'all 0.2s ease'
                }}
              />
              <button
                type="button"
                onClick={() => setVerPassword(!verPassword)}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: '#16A34A',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  userSelect: 'none'
                }}
              >
                {verPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            {errores?.contrasena && (
              <span style={{ fontSize: '11px', fontWeight: '500', color: '#EF4444', marginTop: '4px', display: 'block' }}>
                {errores?.contrasena}
              </span>
            )}
          </div>

          {/* Botón Principal Verde EcoPac */}
          <div style={{ marginTop: '6px' }}>
            <button
              type="submit"
              disabled={enviando}
              style={{
                width: '100%',
                display: 'block',
                padding: '12px',
                backgroundColor: '#22C55E',
                color: '#FFFFFF',
                fontWeight: '700',
                fontSize: '14px',
                border: 'none',
                borderRadius: '9999px',
                boxShadow: '0 10px 15px -3px rgba(34, 197, 94, 0.35)',
                cursor: enviando ? 'not-allowed' : 'pointer',
                opacity: enviando ? 0.7 : 1,
                transition: 'background-color 0.2s ease, transform 0.1s ease'
              }}
            >
              {enviando ? 'Ingresando...' : 'Iniciar Sesión'}
            </button>
          </div>

          {/* Enlaces al Pie */}
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            textAlign: 'center',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#64748B'
          }}>
            <Link to="/registro" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: '500' }}>
              ¿No tienes cuenta?
            </Link>
            <span style={{ color: '#CBD5E1' }}>|</span>
            <Link to="/restablecer-contrasena" style={{ color: '#2563EB', textDecoration: 'none', fontWeight: '500' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}