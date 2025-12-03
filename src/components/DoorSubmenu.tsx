// src/components/DoorSubmenu.tsx
import React, { useState } from 'react';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { DoorFormulaGenerator } from './DoorFormulaGenerator';
import Waringoption from './Waringoption';

interface DoorSubmenuProps {
  onBack: () => void;
  onNavigateToCalculator: (
    option: 'quote' | 'work',
    line: 'L3' | 'L2',
    componentType: 'door' | 'window',
    windowType?: string,
    width?: string,
    height?: string
  ) => void;
}

function DoorIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#003366"
      strokeWidth="1.5"
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <rect x="4" y="4" width="12" height="16" />
      <line x1="4" y1="12" x2="16" y2="12" />
      <circle cx="14" cy="12" r="1" />
    </svg>
  );
}

export function DoorSubmenu({ onBack, onNavigateToCalculator }: DoorSubmenuProps) {
  const [showFormulaGenerator, setShowFormulaGenerator] = useState(false);
  const [showWarning, setShowWarning] =
    useState<null | 'SERIE50' | 'LINEA_ESPANOLA'>(null);

  // 1) Prioridad: generador de fórmulas
  if (showFormulaGenerator) {
    return <DoorFormulaGenerator onBack={() => setShowFormulaGenerator(false)} />;
  }

  // 2) Segundo: pantalla de advertencia (no disponible)
  if (showWarning) {
    return (
      <Waringoption
        onBack={() => setShowWarning(null)}
        // Si algún día quieres personalizar el título:
        // title={showWarning === 'SERIE50' ? 'SERIE 50' : 'LÍNEA ESPAÑOLA'}
      />
    );
  }

  // 3) Menú principal de puertas
  return (
    <div className="min-h-screen bg-[#003366] flex flex-col items-center px-4 animate-fade-in">
      <div className="w-full pt-6 px-6">
        <button
          onClick={onBack}
          className="text-white hover:text-gray-300 transition-colors"
          aria-label="Volver al menú principal"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      <div className="text-center my-8">
        <h1 className="text-white text-5xl font-bold">PUERTAS</h1>
      </div>

      <div className="grid grid-cols-1 gap-8 w-full max-w-xl">
        {/* LÍNEA NACIONAL DE 3 -> calculadora de trabajo */}
        <button
          onClick={() => onNavigateToCalculator('work', 'L3', 'door')}
          className="flex flex-col items-center group"
        >
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg mb-2 transition-transform group-hover:scale-105">
            <DoorIcon />
          </div>
          <span className="text-white text-lg font-bold">LÍNEA NACIONAL DE 3</span>
        </button>

        {/* SERIE 50 -> pantalla “no disponible” */}
        <button
          onClick={() => setShowWarning('SERIE50')}
          className="flex flex-col items-center group"
        >
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg mb-2 transition-transform group-hover:scale-105">
            <DoorIcon />
          </div>
          <span className="text-white text-lg font-bold">SERIE 50</span>
        </button>

        {/* LÍNEA ESPAÑOLA -> pantalla “no disponible” */}
        <button
          onClick={() => setShowWarning('LINEA_ESPANOLA')}
          className="flex flex-col items-center group"
        >
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg mb-2 transition-transform group-hover:scale-105">
            <DoorIcon />
          </div>
          <span className="text-white text-lg font-bold">LÍNEA ESPAÑOLA</span>
        </button>

        {/* GENERADOR DE FÓRMULA */}
        <button
          onClick={() => setShowFormulaGenerator(true)}
          className="flex flex-col items-center group"
        >
          <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center shadow-lg mb-2 transition-transform group-hover:scale-105">
            <FlaskConical size={48} className="text-[#003366]" />
          </div>
          <span className="text-white text-lg font-bold">GENERADOR DE FÓRMULA</span>
        </button>
      </div>
    </div>
  );
}
