import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Calculator, Play, Package, Edit, RotateCcw, X } from 'lucide-react';
import { DoorFormulaCuttingWorkflow } from './DoorFormulaCuttingWorkflow';
import { DoorFormulaPackagePieces } from './DoorFormulaPackagePieces';

interface Operation {
  type: 'suma' | 'resta' | 'multiplicacion' | 'division';
  value: number;
}

interface ProfileFormula {
  id: string;
  profileName: string;
  appliesTo: 'ancho' | 'alto';
  operations: Operation[];
  pieces: number;
}

interface CustomCalculator {
  id: string;
  name: string;
  formulas: ProfileFormula[];
  originalFormulas: ProfileFormula[];
  createdAt: string;
  lastModified?: string;
}

interface DoorFormulaGeneratorProps {
  onBack: () => void;
}

export function DoorFormulaGenerator({ onBack }: DoorFormulaGeneratorProps) {
  const [currentView, setCurrentView] = useState<'list' | 'create' | 'edit' | 'run'>('list');
  const [calculators, setCalculators] = useState<CustomCalculator[]>([]);
  const [selectedCalculator, setSelectedCalculator] = useState<CustomCalculator | null>(null);

  const [showCuttingWorkflow, setShowCuttingWorkflow] = useState(false);
  const [showFormulaPackagePieces, setShowFormulaPackagePieces] = useState(false);

  const [calculatorName, setCalculatorName] = useState('');
  const [formulas, setFormulas] = useState<ProfileFormula[]>([]);
  const [editingCalculatorId, setEditingCalculatorId] = useState<string | null>(null);
  const [editingFormulaId, setEditingFormulaId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState({
    profileName: '',
    appliesTo: 'ancho' as 'ancho' | 'alto',
    operations: [] as Operation[],
    pieces: ''
  });

  const [measurements, setMeasurements] = useState({ ancho: '', alto: '' });
  const [results, setResults] = useState<{ profileName: string; result: number; pieces: number }[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('doorCustomCalculators');
    if (saved) {
      try {
        setCalculators(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading door calculators:', error);
      }
    }
  }, []);

  const saveCalculators = (newCalculators: CustomCalculator[]) => {
    setCalculators(newCalculators);
    localStorage.setItem('doorCustomCalculators', JSON.stringify(newCalculators));
  };

  const addOperation = () => {
    setCurrentProfile(prev => ({
      ...prev,
      operations: [...prev.operations, { type: 'suma', value: 0 }]
    }));
  };

  const updateOperation = (index: number, field: 'type' | 'value', value: any) => {
    setCurrentProfile(prev => ({
      ...prev,
      operations: prev.operations.map((op, i) =>
        i === index ? { ...op, [field]: value } : op
      )
    }));
  };

  const removeOperation = (index: number) => {
    setCurrentProfile(prev => ({
      ...prev,
      operations: prev.operations.filter((_, i) => i !== index)
    }));
  };

  const saveCurrentProfile = () => {
    if (!currentProfile.profileName.trim()) {
      alert('Por favor ingrese el nombre del perfil');
      return;
    }

    if (!currentProfile.pieces || currentProfile.pieces.trim() === '') {
      alert('Por favor ingrese el número de piezas');
      return;
    }

    const piecesNumber = parseInt(currentProfile.pieces);
    if (isNaN(piecesNumber) || piecesNumber <= 0) {
      alert('Por favor ingrese un número válido de piezas mayor a 0');
      return;
    }

    if (editingFormulaId) {
      setFormulas(prev => prev.map(f =>
        f.id === editingFormulaId ? {
          ...f,
          profileName: currentProfile.profileName,
          appliesTo: currentProfile.appliesTo,
          operations: [...currentProfile.operations],
          pieces: piecesNumber
        } : f
      ));
      setEditingFormulaId(null);
    } else {
      const newFormula: ProfileFormula = {
        id: crypto.randomUUID(),
        profileName: currentProfile.profileName,
        appliesTo: currentProfile.appliesTo,
        operations: [...currentProfile.operations],
        pieces: piecesNumber
      };
      setFormulas(prev => [...prev, newFormula]);
    }

    setCurrentProfile({
      profileName: '',
      appliesTo: 'ancho',
      operations: [],
      pieces: ''
    });
  };

  const removeFormula = (id: string) => {
    setFormulas(prev => prev.filter(f => f.id !== id));
  };

  const editFormula = (formula: ProfileFormula) => {
    setCurrentProfile({
      profileName: formula.profileName,
      appliesTo: formula.appliesTo,
      operations: [...formula.operations],
      pieces: formula.pieces.toString()
    });
    setEditingFormulaId(formula.id);
  };

  const cancelEditingFormula = () => {
    setCurrentProfile({
      profileName: '',
      appliesTo: 'ancho',
      operations: [],
      pieces: ''
    });
    setEditingFormulaId(null);
  };

  const saveCalculator = () => {
    if (!calculatorName.trim()) {
      alert('Por favor ingrese el nombre de la calculadora');
      return;
    }

    if (formulas.length === 0) {
      alert('Por favor agregue al menos una fórmula');
      return;
    }

    if (editingCalculatorId) {
      const updatedCalculators = calculators.map(calc =>
        calc.id === editingCalculatorId ? {
          ...calc,
          name: calculatorName,
          formulas: [...formulas],
          lastModified: new Date().toISOString()
        } : calc
      );
      saveCalculators(updatedCalculators);
      setEditingCalculatorId(null);
      alert('¡Calculadora actualizada exitosamente!');
    } else {
      const formulasCopy = JSON.parse(JSON.stringify(formulas));
      const newCalculator: CustomCalculator = {
        id: crypto.randomUUID(),
        name: calculatorName,
        formulas: [...formulas],
        originalFormulas: formulasCopy,
        createdAt: new Date().toISOString()
      };
      const updatedCalculators = [...calculators, newCalculator];
      saveCalculators(updatedCalculators);
      alert('¡Calculadora guardada exitosamente!');
    }

    setCalculatorName('');
    setFormulas([]);
    setCurrentView('list');
  };

  const deleteCalculator = (id: string) => {
    if (confirm('¿Estás seguro que deseas eliminar esta calculadora?')) {
      const updatedCalculators = calculators.filter(c => c.id !== id);
      saveCalculators(updatedCalculators);
    }
  };

  const editCalculator = (calculator: CustomCalculator) => {
    setCalculatorName(calculator.name);
    setFormulas([...calculator.formulas]);
    setEditingCalculatorId(calculator.id);
    setCurrentView('edit');
  };

  const restoreToOriginal = () => {
    if (!editingCalculatorId) return;

    const calculator = calculators.find(c => c.id === editingCalculatorId);
    if (!calculator) return;

    if (confirm('¿Estás seguro que deseas restaurar esta calculadora a su estado original? Se perderán todos los cambios actuales.')) {
      setFormulas(JSON.parse(JSON.stringify(calculator.originalFormulas)));
      alert('¡Calculadora restaurada al estado original!');
    }
  };

  const runCalculator = (calculator: CustomCalculator) => {
    setSelectedCalculator(calculator);
    setMeasurements({ ancho: '', alto: '' });
    setResults([]);
    setCurrentView('run');
  };

  const isCalculatorModified = (calculator: CustomCalculator): boolean => {
    return JSON.stringify(calculator.formulas) !== JSON.stringify(calculator.originalFormulas);
  };

  useEffect(() => {
    if (!selectedCalculator || !measurements.ancho || !measurements.alto) {
      setResults([]);
      return;
    }

    const ancho = parseFloat(measurements.ancho);
    const alto = parseFloat(measurements.alto);

    if (isNaN(ancho) || isNaN(alto) || ancho <= 0 || alto <= 0) {
      setResults([]);
      return;
    }

    const calculatedResults = selectedCalculator.formulas.map(formula => {
      let baseValue = formula.appliesTo === 'ancho' ? ancho : alto;

      formula.operations.forEach(operation => {
        switch (operation.type) {
          case 'suma':
            baseValue += operation.value;
            break;
          case 'resta':
            baseValue -= operation.value;
            break;
          case 'multiplicacion':
            baseValue *= operation.value;
            break;
          case 'division':
            if (operation.value !== 0) {
              baseValue /= operation.value;
            }
            break;
        }
      });

      return {
        profileName: formula.profileName,
        result: Math.max(0, baseValue),
        pieces: formula.pieces
      };
    });

    setResults(calculatedResults);
  }, [selectedCalculator, measurements.ancho, measurements.alto]);

  const handleStartWorking = () => {
    if (!selectedCalculator || results.length === 0) {
      alert('Por favor ingrese las medidas primero');
      return;
    }
    setShowCuttingWorkflow(true);
  };

  const handleAddToPackage = () => {
    if (!selectedCalculator || results.length === 0) {
      alert('Por favor ingrese las medidas primero');
      return;
    }

    const currentPieces = JSON.parse(localStorage.getItem('doorFormulaGeneratorPackagePieces') || '[]');
    const nextDoorNumber = currentPieces.length > 0 ?
      Math.max(...currentPieces.map((p: any) => {
        const parts = p.doorType.split(' ');
        const lastPart = parts[parts.length - 1];
        return parseInt(lastPart) || 0;
      })) + 1 :
      1;

    const piecesToAdd = results.map(result => ({
      type: result.profileName.toUpperCase(),
      measure: result.result.toFixed(1),
      pieces: result.pieces,
      doorType: `${selectedCalculator.name} ${nextDoorNumber}`
    }));

    localStorage.setItem('doorFormulaGeneratorPackagePieces', JSON.stringify([...currentPieces, ...piecesToAdd]));
    alert('¡Piezas agregadas al paquete!');
  };

  const getOperationSymbol = (type: string) => {
    switch (type) {
      case 'suma': return '+';
      case 'resta': return '-';
      case 'multiplicacion': return '×';
      case 'division': return '÷';
      default: return '+';
    }
  };

  const formatFormula = (formula: ProfileFormula) => {
    let formulaText = formula.appliesTo.toUpperCase();
    formula.operations.forEach(op => {
      formulaText += ` ${getOperationSymbol(op.type)} ${op.value === 0 ? '0' : op.value}`;
    });
    return formulaText;
  };

  if (currentView === 'run' && selectedCalculator && showCuttingWorkflow) {
    return (
      <DoorFormulaCuttingWorkflow
        onBack={() => setShowCuttingWorkflow(false)}
        calculatorName={selectedCalculator.name}
        results={results}
        measurements={measurements}
      />
    );
  }

  if (showFormulaPackagePieces) {
    return (
      <DoorFormulaPackagePieces
        onBack={() => setShowFormulaPackagePieces(false)}
      />
    );
  }

  if (currentView === 'list') {
    return (
      <div className="min-h-screen bg-[#003366] flex flex-col items-center px-4 animate-fade-in">
        <div className="w-full pt-6 px-6 flex justify-between items-center">
          <button
            onClick={onBack}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFormulaPackagePieces(true)}
              className="bg-purple-500 text-white px-3 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1 text-sm"
            >
              <Package size={16} />
              <span className="hidden sm:inline">Paquete de Fórmulas</span>
              <span className="sm:hidden">Paquete</span>
            </button>
            <button
              onClick={() => setCurrentView('create')}
              className="bg-white text-[#003366] px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Nueva Calculadora
            </button>
          </div>
        </div>

        <div className="text-center my-8">
          <h1 className="text-white text-5xl font-bold">GENERADOR DE FÓRMULAS</h1>
          <div className="bg-white text-[#003366] px-6 py-2 rounded-full mt-4">
            <span className="font-bold">PUERTAS</span>
          </div>
          <p className="text-gray-300 text-lg mt-4">
            Crea calculadoras personalizadas con tus propias fórmulas
          </p>
        </div>

        <div className="w-full max-w-4xl">
          {calculators.length === 0 ? (
            <div className="bg-white rounded-lg p-8 text-center">
              <Calculator size={64} className="text-gray-400 mx-auto mb-4" />
              <h3 className="text-2xl font-bold text-gray-600 mb-2">No hay calculadoras personalizadas</h3>
              <p className="text-gray-500 mb-6">
                Crea tu primera calculadora personalizada para empezar
              </p>
              <button
                onClick={() => setCurrentView('create')}
                className="bg-[#003366] text-white px-6 py-3 rounded-lg hover:bg-blue-800 transition-colors flex items-center gap-2 mx-auto"
              >
                <Plus size={20} />
                Crear Primera Calculadora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {calculators.map((calculator) => (
                <div key={calculator.id} className="bg-white rounded-lg p-6 shadow-lg relative">
                  {isCalculatorModified(calculator) && (
                    <div className="absolute top-2 right-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                      Modificado
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-[#003366] mb-1">{calculator.name}</h3>
                      <p className="text-gray-600 text-sm">
                        {calculator.formulas.length} perfil{calculator.formulas.length !== 1 ? 'es' : ''}
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        Creado: {new Date(calculator.createdAt).toLocaleDateString()}
                      </p>
                      {calculator.lastModified && (
                        <p className="text-orange-600 text-xs">
                          Modificado: {new Date(calculator.lastModified).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Calculator size={24} className="text-[#003366]" />
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Perfiles:</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {calculator.formulas.map((formula) => (
                        <div key={formula.id} className="text-xs bg-gray-50 p-2 rounded">
                          <div className="font-medium">{formula.profileName} ({formula.pieces} pz)</div>
                          <div className="text-gray-600">{formatFormula(formula)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => runCalculator(calculator)}
                        className="flex-1 bg-[#003366] text-white py-2 px-3 rounded-lg hover:bg-blue-800 transition-colors flex items-center justify-center gap-1 text-sm"
                      >
                        <Play size={16} />
                        Ejecutar
                      </button>
                      <button
                        onClick={() => editCalculator(calculator)}
                        className="flex-1 bg-green-600 text-white py-2 px-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-1 text-sm"
                      >
                        <Edit size={16} />
                        Editar
                      </button>
                    </div>
                    <button
                      onClick={() => deleteCalculator(calculator.id)}
                      className="w-full bg-red-600 text-white py-2 px-3 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-1 text-sm"
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (currentView === 'create' || currentView === 'edit') {
    return (
      <div className="min-h-screen bg-[#003366] flex flex-col items-center px-4 animate-fade-in">
        <div className="w-full pt-6 px-6 flex justify-between items-center">
          <button
            onClick={() => {
              setCurrentView('list');
              setEditingCalculatorId(null);
              setCalculatorName('');
              setFormulas([]);
            }}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-white text-2xl font-bold">
            {currentView === 'edit' ? 'Editar Calculadora' : 'Nueva Calculadora'}
          </h1>
          {currentView === 'edit' && (
            <button
              onClick={restoreToOriginal}
              className="bg-orange-500 text-white px-3 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1 text-sm"
              title="Restaurar a estado original"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Restaurar</span>
            </button>
          )}
          {currentView === 'create' && <div className="w-6"></div>}
        </div>

        <div className="w-full max-w-4xl bg-white rounded-lg p-4 sm:p-6 mt-8">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nombre de la Calculadora
            </label>
            <input
              type="text"
              value={calculatorName}
              onChange={(e) => setCalculatorName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Ej: Puerta Europea, Puerta Francesa, etc."
            />
          </div>

          <div className="border-t pt-6 mb-6">
            <h3 className="text-lg font-bold text-[#003366] mb-4">Agregar Perfil</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre del Perfil
                </label>
                <input
                  type="text"
                  value={currentProfile.profileName}
                  onChange={(e) => setCurrentProfile(prev => ({ ...prev, profileName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Ej: Batiente, Marco, Cerco"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Aplicar a
                </label>
                <select
                  value={currentProfile.appliesTo}
                  onChange={(e) => setCurrentProfile(prev => ({ ...prev, appliesTo: e.target.value as 'ancho' | 'alto' }))}
                  className="w-full px-3 py-2 border rounded-md"
                >
                  <option value="ancho">Ancho</option>
                  <option value="alto">Alto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de Piezas
                </label>
                <input
                  type="text"
                  value={currentProfile.pieces}
                  onChange={(e) => setCurrentProfile(prev => ({ ...prev, pieces: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-md"
                  placeholder="Ej: 1, 2, 3..."
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Operaciones
                </label>
                <button
                  onClick={addOperation}
                  className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Agregar Operación
                </button>
              </div>

              {currentProfile.operations.map((operation, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <select
                    value={operation.type}
                    onChange={(e) => updateOperation(index, 'type', e.target.value)}
                    className="px-3 py-2 border rounded-md flex-grow"
                  >
                    <option value="suma">Suma (+)</option>
                    <option value="resta">Resta (-)</option>
                    <option value="multiplicacion">Multiplicación (×)</option>
                    <option value="division">División (÷)</option>
                  </select>
                  <input
                    type="number"
                    step="0.1"
                    value={operation.value === 0 ? '' : operation.value}
                    onChange={(e) => updateOperation(index, 'value', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                    className="px-3 py-2 border rounded-md flex-grow min-w-0"
                    placeholder="Valor"
                  />
                  <button
                    onClick={() => removeOperation(index)}
                    className="text-red-500 hover:text-red-700 bg-white p-2 rounded-md"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveCurrentProfile}
                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
              >
                {editingFormulaId ? <Save size={16} /> : <Plus size={16} />}
                {editingFormulaId ? 'Actualizar Perfil' : 'Guardar Perfil'}
              </button>
              {editingFormulaId && (
                <button
                  onClick={cancelEditingFormula}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 flex items-center gap-2"
                >
                  <X size={16} />
                  Cancelar
                </button>
              )}
            </div>
          </div>

          {formulas.length > 0 && (
            <div className="border-t pt-6 mb-6">
              <h3 className="text-lg font-bold text-[#003366] mb-4">Perfiles Agregados</h3>
              <div className="space-y-3">
                {formulas.map((formula) => (
                  <div key={formula.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                    <div>
                      <div className="font-medium text-[#003366]">
                        {formula.profileName} ({formula.pieces} pieza{formula.pieces !== 1 ? 's' : ''})
                      </div>
                      <div className="text-sm text-gray-600">
                        Fórmula: {formatFormula(formula)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => editFormula(formula)}
                        className="text-blue-500 hover:text-blue-700 p-2"
                        title="Editar perfil"
                      >
                        <Edit size={20} />
                      </button>
                      <button
                        onClick={() => removeFormula(formula.id)}
                        className="text-red-500 hover:text-red-700 p-2"
                        title="Eliminar perfil"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t">
            <button
              onClick={() => {
                setCurrentView('list');
                setEditingCalculatorId(null);
                setCalculatorName('');
                setFormulas([]);
              }}
              className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              onClick={saveCalculator}
              className="px-6 py-2 bg-[#003366] text-white rounded-lg hover:bg-blue-800 flex items-center gap-2"
            >
              <Save size={18} />
              {currentView === 'edit' ? 'Guardar Cambios' : 'Guardar Calculadora'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (currentView === 'run' && selectedCalculator) {
    return (
      <div className="min-h-screen bg-[#003366] flex flex-col items-center px-4 animate-fade-in">
        <div className="w-full pt-6 px-6 flex justify-between items-center">
          <button
            onClick={() => setCurrentView('list')}
            className="text-white hover:text-gray-300 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-white text-2xl font-bold">{selectedCalculator.name}</h1>
          <div className="w-6"></div>
        </div>

        <div className="w-full max-w-2xl bg-white rounded-lg p-6 mt-8">
          <h3 className="text-xl font-bold text-[#003366] mb-6">Ingrese las Medidas</h3>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ancho (cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={measurements.ancho}
                onChange={(e) => setMeasurements(prev => ({ ...prev, ancho: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg text-center text-xl"
                placeholder="0.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Alto (cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={measurements.alto}
                onChange={(e) => setMeasurements(prev => ({ ...prev, alto: e.target.value }))}
                className="w-full px-4 py-2 border rounded-lg text-center text-xl"
                placeholder="0.0"
              />
            </div>
          </div>

          {results.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-xl font-bold text-[#003366] mb-4">Resultados</h3>

              <div className="flex gap-2 mb-6">
                <button
                  onClick={handleStartWorking}
                  className="flex-1 bg-blue-500 text-white py-2 px-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-1 text-sm"
                >
                  <Play size={16} />
                  Empezar a Trabajar
                </button>
                <button
                  onClick={handleAddToPackage}
                  className="flex-1 bg-purple-500 text-white py-2 px-3 rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-1 text-sm"
                >
                  <Plus size={16} />
                  Agregar a Paquete
                </button>
              </div>

              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg flex justify-between items-center">
                    <div className="font-medium text-[#003366]">
                      {result.profileName}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">
                        {result.pieces} pz {result.result.toFixed(1)} cm
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
