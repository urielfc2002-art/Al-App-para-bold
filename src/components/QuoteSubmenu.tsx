import React, { useState } from 'react';
import { ArrowLeft, DollarSign, FileText } from 'lucide-react';

interface QuoteSubmenuProps {
  onBack: () => void;
  onNavigateToScreen: (screen: string) => void;
}

export function QuoteSubmenu({ onBack, onNavigateToScreen }: QuoteSubmenuProps) {
  console.log('🔍 QuoteSubmenu - Componente renderizado. Props:', { onBack, onNavigateToScreen });

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
        <h1 className="text-white text-5xl font-bold mb-4">COTIZADOR</h1>
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full">
          <span className="font-bold">VENTANAS LINEA DE 3</span>
        </div>
      </div>

      <div className="w-full max-w-2xl grid grid-cols-2 gap-6 mt-12 px-4">
        <button 
          className="group flex flex-col items-center transition-transform hover:scale-105"
          onClick={() => {
            console.log('🔍 QuoteSubmenu - Clic en BASE DE DATOS. Navegando a priceDatabase.');
            onNavigateToScreen('priceDatabase');
          }}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
            <span className="text-[#003366] text-3xl font-bold">$</span>
          </div>
          <span className="text-white text-xl font-bold">BASE DE DATOS</span>
        </button>

        <button
          className="group flex flex-col items-center transition-transform hover:scale-105"
          onClick={() => {
            console.log('🔍 QuoteSubmenu - Clic en COTIZADOR GENERAL. Navegando a generalQuote.');
            onNavigateToScreen('generalQuote');
          }}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
            <DollarSign size={28} className="text-[#003366]" />
          </div>
          <span className="text-white text-xl font-bold">COTIZADOR GENERAL</span>
        </button>

        <button
          className="group flex flex-col items-center transition-transform hover:scale-105"
          onClick={() => {
            console.log('🔍 QuoteSubmenu - Clic en COTIZA VENTANAS. Navegando a windowQuote.');
            onNavigateToScreen('windowQuote');
          }}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#003366"
              strokeWidth="1.5"
              strokeLinecap="square"
              strokeLinejoin="miter"
            >
              <rect x="4" y="4" width="16" height="16" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
          </div>
          <span className="text-white text-xl font-bold">COTIZA VENTANAS</span>
        </button>

        <button
          className="group flex flex-col items-center transition-transform hover:scale-105 cursor-pointer"
          onClick={() => {
            console.log('🔍 QuoteSubmenu - Clic en HOJA DE COTIZACIÓN. Navegando a quoteSheetHome.');
            onNavigateToScreen('quoteSheetHome');
          }}
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
            <FileText size={28} className="text-[#003366]" />
          </div>
          <span className="text-white text-xl font-bold">HOJA DE COTIZACIÓN</span>
        </button>
      </div>
    </div>
  );
}
