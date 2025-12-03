import React, { useState } from 'react';
import WindowCalculator from './WindowCalculator';
import { WindowCalculatorLine2 } from './WindowCalculatorLine2';
import { TwoFixedTwoSlidingCalculator } from './TwoFixedTwoSlidingCalculator';
import { FourSlidingCalculator } from './FourSlidingCalculator';
import { ArrowLeft, Package2, FlaskConical } from 'lucide-react';
import { PackagePieces } from './PackagePieces';
import { XXCalculator } from './XXCalculator';
import { TroquelCalculator } from './TroquelCalculator';
import { FormulaGenerator } from './FormulaGenerator';

type WindowType = {
  id: string;
  title: string;
  panels: number;
  type: string;
};

const windowTypes: Record<string, WindowType[]> = {
  'LÍNEA NACIONAL DE 3': [
    { id: 'fc', title: 'Fijo Corredizo', panels: 2, type: 'fixed-sliding' },
    { id: 'xx', title: 'Doble Corrediza', panels: 2, type: 'xx' },
    { id: 'fccf', title: '2 Fijos y 2 Corredizos', panels: 4, type: 'fixed-sliding-sliding-fixed' },
    { id: 'cccc', title: '4 Corredizas', panels: 4, type: 'sliding-all' },
  ],
  'LÍNEA NACIONAL DE 2': [
    { id: 'fc-2', title: 'Fijo y Corredizo', panels: 2, type: 'fixed-sliding' },
    { id: 'cc-2', title: 'Doble Corrediza', panels: 2, type: 'sliding-sliding' },
  ],
};

interface WindowButtonProps {
  type: WindowType;
  onClick: (type: WindowType) => void;
}

export function WindowButton({ type, onClick }: WindowButtonProps) {
  return (
    <button
      onClick={() => onClick(type)}
      className="group flex flex-col items-center mb-6 transition-transform hover:scale-105"
      aria-label={`Seleccionar ventana tipo ${type.title}`}
    >
      <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
        <WindowIcon type={type} />
      </div>
      <span className="text-white text-lg font-bold mt-2">{type.title}</span>
    </button>
  );
}

function WindowIcon({ type }: { type: WindowType }) {
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
      <rect x="4" y="4" width="16" height="16" />
      {type.panels === 2 && (
        <line x1="12" y1="4" x2="12" y2="20" />
      )}
      {type.panels === 4 && (
        <>
          <line x1="8" y1="4" x2="8" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <line x1="16" y1="4" x2="16" y2="20" />
        </>
      )}
    </svg>
  );
}

interface WindowSubmenuProps {
  onClose: () => void;
  onNavigateToCalculator: (
    option: 'quote' | 'work',
    line: 'L3' | 'L2',
    componentType: 'door' | 'window', 
    windowType?: string,
    width?: string, 
    height?: string
  ) => void;
}

export function WindowSubmenu({ onClose, onNavigateToCalculator }: WindowSubmenuProps) {
  const [showPackagePieces, setShowPackagePieces] = useState(false);
  const [showTroquelCalculator, setShowTroquelCalculator] = useState(false);
  const [showFormulaGenerator, setShowFormulaGenerator] = useState(false);

  const handleWindowSelect = (type: WindowType) => {
    // Map window types to calculator screens
    if (type.id === 'fc') {
      onNavigateToCalculator('work', 'L3', 'window', 'fixed-sliding-window');
    } else if (type.id === 'xx') {
      onNavigateToCalculator('work', 'L3', 'window', 'double-sliding-window');
    } else if (type.id === 'fccf') {
      onNavigateToCalculator('work', 'L3', 'window', 'two-fixed-two-sliding-window');
    } else if (type.id === 'cccc') {
      onNavigateToCalculator('work', 'L3', 'window', 'four-sliding-window');
    } else if (type.id === 'fc-2') {
      onNavigateToCalculator('work', 'L2', 'window', 'fixed-sliding-window');
    } else if (type.id === 'cc-2') {
      onNavigateToCalculator('work', 'L2', 'window', 'double-sliding-window');
    }
  };

  if (showPackagePieces) {
    return <PackagePieces onBack={() => setShowPackagePieces(false)} />;
  }

  if (showTroquelCalculator) {
    return <TroquelCalculator onBack={() => setShowTroquelCalculator(false)} />;
  }

  if (showFormulaGenerator) {
    return <FormulaGenerator onBack={() => setShowFormulaGenerator(false)} />;
  }

  return (
    <div className="min-h-screen bg-[#003366] flex flex-col items-center px-4 animate-fade-in">
      <div className="w-full pt-6 px-6">
        <button
          onClick={onClose}
          className="text-white hover:text-gray-300 transition-colors"
          aria-label="Volver al menú principal"
        >
          <ArrowLeft size={24} />
        </button>
      </div>

      <div className="text-center my-8">
        <h1 className="text-white text-5xl font-bold">VENTANAS</h1>
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full mt-4">
          <span className="font-bold">LÍNEA NACIONAL DE 3</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        {windowTypes['LÍNEA NACIONAL DE 3'].map((type) => (
          <WindowButton key={type.id} type={type} onClick={handleWindowSelect} />
        ))}
      </div>

      <div className="text-center mt-12">
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full">
          <span className="font-bold">LÍNEA NACIONAL DE 2</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4 mt-8">
        {windowTypes['LÍNEA NACIONAL DE 2'].map((type) => (
          <WindowButton key={type.id} type={type} onClick={handleWindowSelect} />
        ))}
      </div>

      <div className="text-center mt-12">
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full">
          <span className="font-bold">LISTA DE TRABAJO</span>
        </div>
      </div>

      <div className="flex items-center justify-center mt-8">
        <button 
          className="group flex flex-col items-center transition-transform hover:scale-105"
          onClick={() => setShowTroquelCalculator(true)}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
            <Package2 size={48} className="text-[#003366]" />
          </div>
          <span className="text-white text-lg font-bold mt-2">Paquete de Ventanas</span>
        </button>
      </div>

      <div className="text-center mt-12">
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full">
          <span className="font-bold">CREADOR DE FÓRMULA</span>
        </div>
      </div>

      <div className="flex items-center justify-center mt-8">
        <button 
          className="group flex flex-col items-center transition-transform hover:scale-105"
          onClick={() => setShowFormulaGenerator(true)}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg">
            <FlaskConical size={48} className="text-[#003366]" />
          </div>
          <span className="text-white text-lg font-bold mt-2">GENERADOR DE FÓRMULA</span>
        </button>
      </div>

      <div className="text-center mt-12 mb-8">
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full">
          <span className="font-bold">SERIE 50 ...</span>
        </div>
        <p className="text-white text-lg mt-4 font-medium">Próximamente</p>
      </div>
    </div>
  );
}