import React, { useState, useEffect } from 'react';
import { ArrowLeft, Trash2, Eye, Calendar, DollarSign, Package, Save, FolderOpen, Plus, X, RefreshCw } from 'lucide-react';
import { SaveQuoteModal } from './SaveQuoteModal';
import { SavedQuotesModal } from './SavedQuotesModal';
import { AddAdditionalItemsModal, SelectedItem } from './AddAdditionalItemsModal';
import { optimizeCutting, calculateProfileOptimization, calculateJambaOptimization } from '../utils/cuttingOptimizer';
import { getProfilePriceWithIVA, calculateHardwareCostWithIVA } from '../utils/priceCalculations';
import { useSyncedState } from '../hooks/useSyncedState';
import { usePriceUpdates } from '../hooks/usePriceUpdates';

interface StandaloneHardwareItem {
  name: string;
  quantity: number;
  chargingMethod: 'package' | 'piece';
  basePricePerPackage: number;
  basePricePerPiece: number;
  category: 'tornillos' | 'felpas' | 'viniles' | 'herrajes';
}

interface QuotedWindow {
  id: string;
  type: string;
  line: string;
  width: string;
  height: string;
  color: string;
  date: string;
  method: 'fraction' | 'gross';
  profiles: {
    name: string;
    totalLength: number;
    cost: number;
  }[];
  hardware?: {
    name: string;
    pieces: number;
    cost: number;
  }[];
  totalCost: number;
}

interface ProfileSummary {
  name: string;
  color: string;
  totalLength: number;
  totalMeters: number;
  piecesNeeded: number;
  totalPiecesNeededGross: number;
  fractionCost: number;
  grossCost: number;
}

interface HardwareSummary {
  name: string;
  pieces: number;
  cost: number;
}

interface ExtraCost {
  id: string;
  name: string;
  amount: number;
}

interface Profile {
  name: string;
  colors: {
    [key: string]: {
      price6m: string;
      pricePerM: string;
    };
  };
}

interface Hardware {
  name: string;
  pricePerPackage: string;
  pricePerPiece: string;
}

interface PackageQuoteManagerProps {
  onBack: () => void;
}

export function PackageQuoteManager({ onBack }: PackageQuoteManagerProps) {
  const [quotedWindows, setQuotedWindows] = useState<QuotedWindow[]>([]);
  const [profileSummary, setProfileSummary] = useState<ProfileSummary[]>([]);
  const [hardwareSummary, setHardwareSummary] = useState<HardwareSummary[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedQuotesModal, setShowSavedQuotesModal] = useState(false);
  const [showAdditionalItemsModal, setShowAdditionalItemsModal] = useState(false);
  const [profitPercentage, setProfitPercentage] = useState<number>(0);
  const [extraCostsList, setExtraCostsList] = useState<ExtraCost[]>([]);
  const [newExtraCostName, setNewExtraCostName] = useState('');
  const [newExtraCostAmount, setNewExtraCostAmount] = useState<number>(0);
  const [materialIvaPercentage, setMaterialIvaPercentage] = useSyncedState<number>('materialIvaPercentage', 16);
  const [userIvaPercentage, setUserIvaPercentage] = useSyncedState<number>('userIvaPercentage', 0);
  const [standaloneHardwareItems, setStandaloneHardwareItems] = useSyncedState<StandaloneHardwareItem[]>('standaloneHardwareItems', []);
  const [selectedCostMethod, setSelectedCostMethod] = useSyncedState<'fraction' | 'gross'>('selectedCostMethod', 'gross');
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false);
  const [priceUpdateNotification, setPriceUpdateNotification] = useState<string | null>(null);

  const { priceData, refreshPriceData } = usePriceUpdates();

  useEffect(() => {
    // Cargar perfiles de la base de datos
    let currentProfiles: Profile[] = [];
    let currentHardware: Hardware[] = [];
    const savedProfiles = localStorage.getItem('windowProfiles');
    if (savedProfiles) {
      try {
        currentProfiles = JSON.parse(savedProfiles);
        setProfiles(currentProfiles);
      } catch (error) {
        console.error('Error loading profiles:', error);
        setProfiles([]);
      }
    }

    // Cargar herrajes de la base de datos
    const savedHardware = localStorage.getItem('windowHardware');
    if (savedHardware) {
      try {
        currentHardware = JSON.parse(savedHardware);
      } catch (error) {
        console.error('Error loading hardware:', error);
      }
    }

    // Cargar ventanas cotizadas
    const savedQuotes = localStorage.getItem('quotedWindowsPackage');
    if (savedQuotes) {
      try {
        const quotes = JSON.parse(savedQuotes);
        
        // Sanitizar datos numéricos para prevenir errores de toFixed
        const sanitizedQuotes = quotes.map((quote: QuotedWindow) => ({
          ...quote,
          totalCost: isNaN(Number(quote.totalCost)) ? 0 : Number(quote.totalCost),
          profiles: quote.profiles?.map(profile => ({
            ...profile,
            totalLength: isNaN(Number(profile.totalLength)) ? 0 : Number(profile.totalLength),
            cost: isNaN(Number(profile.cost)) ? 0 : Number(profile.cost)
          })) || [],
          hardware: quote.hardware?.map(item => ({
            ...item,
            pieces: isNaN(Number(item.pieces)) ? 0 : Number(item.pieces),
            cost: isNaN(Number(item.cost)) ? 0 : Number(item.cost)
          })) || []
        }));
        
        setQuotedWindows(sanitizedQuotes);
        calculateProfileSummary(sanitizedQuotes, currentProfiles);
        calculateHardwareSummary(sanitizedQuotes, standaloneHardwareItems, currentHardware);
      } catch (error) {
        console.error('Error loading quoted windows:', error);
        setQuotedWindows([]);
        setProfileSummary([]);
        setHardwareSummary([]);
      }
    }
  }, [standaloneHardwareItems]);

  // 🔄 REACCIONAR A CAMBIOS EN LA BASE DE DATOS DE PRECIOS
  useEffect(() => {
    if (priceData && priceData.profiles.length > 0) {
      console.log('🔄 Detectados cambios en priceData.timestamp:', priceData.timestamp);
      setProfiles(priceData.profiles);

      // Actualizar IVA si cambió
      if (priceData.materialIvaPercentage !== materialIvaPercentage) {
        console.log('🔄 IVA actualizado:', priceData.materialIvaPercentage);
        setMaterialIvaPercentage(priceData.materialIvaPercentage);
      }

      if (quotedWindows.length > 0 || standaloneHardwareItems.length > 0) {
        console.log('🔄 Precios actualizados, recalculando resúmenes...');
        console.log('📊 Estado actual:', {
          quotedWindows: quotedWindows.length,
          standaloneItems: standaloneHardwareItems.length,
          hardwareInDB: priceData.hardware.length,
          glassInDB: priceData.glass.length
        });

        // Actualizar ventanas cotizadas con nuevos precios
        if (quotedWindows.length > 0) {
          calculateProfileSummary(quotedWindows, priceData.profiles);
        }

        // Actualizar componentes adicionales con nuevos precios
        if (standaloneHardwareItems.length > 0) {
          console.log('🔍 Actualizando precios de componentes adicionales...');
          const updatedStandaloneItems = updateStandaloneItemPrices(standaloneHardwareItems, priceData.hardware, priceData.glass);

          // Siempre actualizar si hay cambios
          const hasChanges = updatedStandaloneItems.some((item, index) => {
            const original = standaloneHardwareItems[index];
            return original && (
              item.basePricePerPackage !== original.basePricePerPackage ||
              item.basePricePerPiece !== original.basePricePerPiece
            );
          });

          if (hasChanges || updatedStandaloneItems.length !== standaloneHardwareItems.length) {
            console.log('✅ Aplicando cambios de precios a componentes adicionales');
            setStandaloneHardwareItems(updatedStandaloneItems);
            setLastPriceUpdate(new Date());
            setPriceUpdateNotification('Precios actualizados correctamente');
            setTimeout(() => setPriceUpdateNotification(null), 5000);
          } else {
            console.log('ℹ️ No hay cambios en los precios de componentes adicionales');
          }
        }

        // Recalcular resumen de herrajes con precios actualizados
        calculateHardwareSummary(
          quotedWindows,
          standaloneHardwareItems.length > 0 ? standaloneHardwareItems : [],
          priceData.hardware
        );
      }
    }
  }, [priceData.timestamp, materialIvaPercentage]);

  const updateStandaloneItemPrices = (
    items: StandaloneHardwareItem[],
    hardwareData: Hardware[],
    glassData: any[]
  ): StandaloneHardwareItem[] => {
    if (items.length === 0) {
      console.log('ℹ️ No hay componentes adicionales para actualizar');
      return items;
    }

    console.log(`🔍 Actualizando ${items.length} componentes adicionales...`);
    let hasChanges = false;
    const updatedItems = items.map(item => {
      console.log(`🔍 Verificando "${item.name}"...`);

      const hardwareInDB = hardwareData.find(h => h.name === item.name);

      if (hardwareInDB) {
        const newBasePricePerPackage = parseFloat(hardwareInDB.pricePerPackage) || 0;
        const newBasePricePerPiece = parseFloat(hardwareInDB.pricePerPiece) || 0;

        console.log(`   Precios en DB: paquete=$${newBasePricePerPackage}, pieza=$${newBasePricePerPiece}`);
        console.log(`   Precios actuales: paquete=$${item.basePricePerPackage}, pieza=$${item.basePricePerPiece}`);

        if (
          newBasePricePerPackage !== item.basePricePerPackage ||
          newBasePricePerPiece !== item.basePricePerPiece
        ) {
          hasChanges = true;
          console.log(`💰 Actualizando precio base de "${item.name}":`);
          console.log(`   Paquete: $${item.basePricePerPackage} → $${newBasePricePerPackage}`);
          console.log(`   Pieza: $${item.basePricePerPiece} → $${newBasePricePerPiece}`);

          return {
            ...item,
            basePricePerPackage: newBasePricePerPackage,
            basePricePerPiece: newBasePricePerPiece
          };
        } else {
          console.log(`   ✓ Sin cambios para "${item.name}"`);
        }
      } else {
        console.log(`   ⚠️ "${item.name}" no encontrado en herrajes, buscando en vidrios...`);
      }

      const glassInDB = glassData.find((g: any) => g.name === item.name);
      if (glassInDB) {
        const newBasePricePerPiece = parseFloat(glassInDB.pricePerPiece) || 0;
        const newBasePricePerM2 = parseFloat(glassInDB.pricePerM2) || 0;

        console.log(`   Precios de vidrio en DB: pieza=$${newBasePricePerPiece}, m²=$${newBasePricePerM2}`);
        console.log(`   Precios actuales: pieza=$${item.basePricePerPiece}`);

        if (newBasePricePerPiece !== item.basePricePerPiece) {
          hasChanges = true;
          console.log(`💰 Actualizando precio base de vidrio "${item.name}": $${item.basePricePerPiece} → $${newBasePricePerPiece} (pieza)`);

          return {
            ...item,
            basePricePerPiece: newBasePricePerPiece
          };
        } else {
          console.log(`   ✓ Sin cambios para vidrio "${item.name}"`);
        }
      } else {
        console.log(`   ⚠️ "${item.name}" no encontrado ni en herrajes ni en vidrios`);
      }

      return item;
    });

    if (hasChanges) {
      console.log('✅ Precios base de componentes adicionales actualizados');
    } else {
      console.log('ℹ️ No se detectaron cambios en los precios');
    }

    return updatedItems;
  };

  // ✅ FUNCIÓN PARA OBTENER PRECIO REAL DE LA BASE DE DATOS CON IVA DE MATERIAL FIJO (16%)
  const getProfilePrice = (profileName: string, color: string, profilesData: Profile[]): { price6m: number; pricePerM: number } => {
    return getProfilePriceWithIVA(profileName, color, profilesData, materialIvaPercentage);
  };

  const calculateProfileSummary = (quotes: QuotedWindow[], profilesData: Profile[]) => {
    const summary: { [key: string]: ProfileSummary } = {};

    quotes.forEach(quote => {
      quote.profiles.forEach(profile => {
        const key = `${profile.name}-${quote.color}`;

        if (!summary[key]) {
          summary[key] = {
            name: profile.name,
            color: quote.color,
            totalLength: 0,
            totalMeters: 0,
            piecesNeeded: 0,
            totalPiecesNeededGross: 0,
            fractionCost: 0,
            grossCost: 0
          };
        }

        // Asegurar que los valores sean números válidos
        const totalLength = isNaN(Number(profile.totalLength)) ? 0 : Number(profile.totalLength);

        summary[key].totalLength += totalLength;
      });
    });

    // 🎯 CALCULAR PIEZAS NECESARIAS Y COSTOS CON PRECIOS ACTUALES DE LA BASE DE DATOS
    Object.values(summary).forEach(profile => {
      profile.totalMeters = profile.totalLength / 100;

      // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA JAMBAS
      if (profile.name === 'JAMBA_L3') {
        console.log('🔧 Aplicando optimización específica para JAMBA_L3');
        const jambaOptimization = calculateJambaOptimization(quotes, 600);
        profile.piecesNeeded = jambaOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización JAMBA_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: jambaOptimization.piecesNeeded,
          sobrantes: jambaOptimization.remainders,
          diferencia: jambaOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'RIEL_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA RIEL LÍNEA 3
        console.log('🔧 Aplicando optimización específica para RIEL_L3');
        const rielOptimization = calculateProfileOptimization('RIEL', quotes, 600);
        profile.piecesNeeded = rielOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización RIEL_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: rielOptimization.piecesNeeded,
          sobrantes: rielOptimization.remainders,
          diferencia: rielOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'RIEL_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA RIEL LÍNEA 2
        console.log('🔧 Aplicando optimización específica para RIEL_L2');
        const rielOptimization = calculateProfileOptimization('RIEL', quotes, 600);
        profile.piecesNeeded = rielOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización RIEL_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: rielOptimization.piecesNeeded,
          sobrantes: rielOptimization.remainders,
          diferencia: rielOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'RIEL ADICIONAL_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA RIEL ADICIONAL LÍNEA 3
        console.log('🔧 Aplicando optimización específica para RIEL ADICIONAL_L3');
        const rielAdicionalOptimization = calculateProfileOptimization('RIEL ADICIONAL', quotes, 600);
        profile.piecesNeeded = rielAdicionalOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización RIEL ADICIONAL_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: rielAdicionalOptimization.piecesNeeded,
          sobrantes: rielAdicionalOptimization.remainders,
          diferencia: rielAdicionalOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'CERCO_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA CERCO LÍNEA 3
        console.log('🔧 Aplicando optimización específica para CERCO_L3');
        const cercoOptimization = calculateProfileOptimization('CERCO', quotes, 600);
        profile.piecesNeeded = cercoOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización CERCO_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: cercoOptimization.piecesNeeded,
          sobrantes: cercoOptimization.remainders,
          diferencia: cercoOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'CERCO_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA CERCO LÍNEA 2
        console.log('🔧 Aplicando optimización específica para CERCO_L2');
        const cercoOptimization = calculateProfileOptimization('CERCO', quotes, 600);
        profile.piecesNeeded = cercoOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización CERCO_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: cercoOptimization.piecesNeeded,
          sobrantes: cercoOptimization.remainders,
          diferencia: cercoOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'RIEL ADICIONAL_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA RIEL ADICIONAL LÍNEA 2
        console.log('🔧 Aplicando optimización específica para RIEL ADICIONAL_L2');
        const rielAdicionalOptimization = calculateProfileOptimization('RIEL ADICIONAL', quotes, 600);
        profile.piecesNeeded = rielAdicionalOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización RIEL ADICIONAL_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: rielAdicionalOptimization.piecesNeeded,
          sobrantes: rielAdicionalOptimization.remainders,
          diferencia: rielAdicionalOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'TRASLAPE_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA TRASLAPE LÍNEA 3
        console.log('🔧 Aplicando optimización específica para TRASLAPE_L3');
        const traslapeOptimization = calculateProfileOptimization('TRASLAPE', quotes, 600);
        profile.piecesNeeded = traslapeOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización TRASLAPE_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: traslapeOptimization.piecesNeeded,
          sobrantes: traslapeOptimization.remainders,
          diferencia: traslapeOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'TRASLAPE_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA TRASLAPE LÍNEA 2
        console.log('🔧 Aplicando optimización específica para TRASLAPE_L2');
        const traslapeOptimization = calculateProfileOptimization('TRASLAPE', quotes, 600);
        profile.piecesNeeded = traslapeOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización TRASLAPE_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: traslapeOptimization.piecesNeeded,
          sobrantes: traslapeOptimization.remainders,
          diferencia: traslapeOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'ZOCLO 1V_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA ZOCLO 1V LÍNEA 3 (SOLO SUPERIORES)
        console.log('🔧 Aplicando optimización específica para ZOCLO 1V_L3 (superiores)');
        const zocloOptimization = calculateProfileOptimization('ZOCLO', quotes, 600, 'superior');
        profile.piecesNeeded = zocloOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización ZOCLO 1V_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: zocloOptimization.piecesNeeded,
          sobrantes: zocloOptimization.remainders,
          diferencia: zocloOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'ZOCLO 2V_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA ZOCLO 2V LÍNEA 3 (SOLO INFERIORES)
        console.log('🔧 Aplicando optimización específica para ZOCLO 2V_L3 (inferiores)');
        const zocloOptimization = calculateProfileOptimization('ZOCLO', quotes, 600, 'inferior');
        profile.piecesNeeded = zocloOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización ZOCLO 2V_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: zocloOptimization.piecesNeeded,
          sobrantes: zocloOptimization.remainders,
          diferencia: zocloOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'CABEZAL_L3') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA CABEZAL LÍNEA 3 (SOLO SUPERIORES)
        console.log('🔧 Aplicando optimización específica para CABEZAL_L3 (superiores)');
        const cabezalOptimization = calculateProfileOptimization('ZOCLO', quotes, 600, 'superior');
        profile.piecesNeeded = cabezalOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización CABEZAL_L3:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: cabezalOptimization.piecesNeeded,
          sobrantes: cabezalOptimization.remainders,
          diferencia: cabezalOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'ZOCLO 1V_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA ZOCLO 1V LÍNEA 2 (SOLO SUPERIORES)
        console.log('🔧 Aplicando optimización específica para ZOCLO 1V_L2 (superiores)');
        const zocloOptimization = calculateProfileOptimization('ZOCLO', quotes, 600, 'superior');
        profile.piecesNeeded = zocloOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización ZOCLO 1V_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: zocloOptimization.piecesNeeded,
          sobrantes: zocloOptimization.remainders,
          diferencia: zocloOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'ZOCLO 2V_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA ZOCLO 2V LÍNEA 2 (SOLO INFERIORES)
        console.log('🔧 Aplicando optimización específica para ZOCLO 2V_L2 (inferiores)');
        const zocloOptimization = calculateProfileOptimization('ZOCLO', quotes, 600, 'inferior');
        profile.piecesNeeded = zocloOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización ZOCLO 2V_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: zocloOptimization.piecesNeeded,
          sobrantes: zocloOptimization.remainders,
          diferencia: zocloOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else if (profile.name === 'CABEZAL_L2') {
        // 🎯 OPTIMIZACIÓN ESPECÍFICA PARA CABEZAL LÍNEA 2 (SOLO SUPERIORES)
        console.log('🔧 Aplicando optimización específica para CABEZAL_L2 (superiores)');
        const cabezalOptimization = calculateProfileOptimization('ZOCLO', quotes, 600, 'superior');
        profile.piecesNeeded = cabezalOptimization.piecesNeeded;

        console.log(`📊 Resultado optimización CABEZAL_L2:`, {
          longitudTotal: profile.totalLength,
          piezasCalculoSimple: Math.ceil(profile.totalLength / 600),
          piezasOptimizadas: cabezalOptimization.piecesNeeded,
          sobrantes: cabezalOptimization.remainders,
          diferencia: cabezalOptimization.piecesNeeded - Math.ceil(profile.totalLength / 600)
        });
      } else {
        profile.piecesNeeded = Math.ceil(profile.totalLength / 600);
        console.log(`📏 Perfil ${profile.name}: usando cálculo simple (${profile.piecesNeeded} piezas)`);
      }

      // 🎯 OBTENER PRECIO REAL DE LA BASE DE DATOS
      const realPrice = getProfilePrice(profile.name, profile.color, profilesData);

      // ✅ CALCULAR COSTO POR FRACCIÓN CON PRECIO ACTUAL (longitud en metros * precio por metro)
      profile.fractionCost = profile.totalMeters * realPrice.pricePerM;

      // ✅ CALCULAR COSTO BRUTO REAL
      profile.grossCost = profile.piecesNeeded * realPrice.price6m;
    });

    setProfileSummary(Object.values(summary));
  };

  const calculateHardwareSummary = (
    quotes: QuotedWindow[], 
    standaloneItems: StandaloneHardwareItem[] = [], 
    hardwareData: Hardware[] = []
  ) => {
    const summary: { [key: string]: HardwareSummary } = {};

    // Procesar herrajes de ventanas cotizadas
    quotes.forEach(quote => {
      if (quote.hardware && quote.hardware.length > 0) {
        quote.hardware.forEach(item => {
          const key = item.name;
          
          if (!summary[key]) {
            summary[key] = {
              name: item.name,
              pieces: 0,
              cost: 0
            };
          }

          // Recalcular costo con IVA actual usando precio base de la base de datos
          const pieces = isNaN(Number(item.pieces)) ? 0 : Number(item.pieces);
          
          // Buscar el herraje en la base de datos para obtener precio base
          const hardwareInDB = hardwareData.find(h => h.name === item.name);
          let cost = 0;
          
          if (hardwareInDB && pieces > 0) {
            const basePricePerPiece = parseFloat(hardwareInDB.pricePerPiece) || 0;
            if (basePricePerPiece > 0) {
              // Calcular costo con IVA de material fijo (16%)
              const { total } = calculateHardwareCostWithIVA(
                0, // No usamos precio por paquete para herrajes de ventanas
                basePricePerPiece,
                pieces,
                'piece',
                materialIvaPercentage
              );
              cost = total;
            } else {
              // Si no hay precio base, usar el costo original (fallback)
              cost = isNaN(Number(item.cost)) ? 0 : Number(item.cost);
            }
          } else {
            // Si no se encuentra en la base de datos, usar el costo original (fallback)
            cost = isNaN(Number(item.cost)) ? 0 : Number(item.cost);
          }

          summary[key].pieces += pieces;
          summary[key].cost += cost;
        });
      }
    });

    // Procesar elementos adicionales independientes
    standaloneItems.forEach(item => {
      const key = item.name;
      
      if (!summary[key]) {
        summary[key] = {
          name: item.name,
          pieces: 0,
          cost: 0
        };
      }

      // Calcular costo con IVA de material fijo (16%) usando precios base almacenados
      const { total } = calculateHardwareCostWithIVA(
        item.basePricePerPackage,
        item.basePricePerPiece,
        item.quantity,
        item.chargingMethod,
        materialIvaPercentage
      );
      
      summary[key].pieces += item.quantity;
      summary[key].cost += total;
    });

    setHardwareSummary(Object.values(summary));
  };

  const handleManualRefresh = async () => {
    setIsRefreshingPrices(true);
    console.log('🔄 Iniciando actualización manual de precios...');

    try {
      await refreshPriceData();
      console.log('✅ Actualización manual completada');
      setPriceUpdateNotification('Precios actualizados manualmente');
      setTimeout(() => setPriceUpdateNotification(null), 3000);
    } catch (error) {
      console.error('❌ Error al actualizar precios manualmente:', error);
      setPriceUpdateNotification('Error al actualizar precios');
      setTimeout(() => setPriceUpdateNotification(null), 3000);
    } finally {
      setIsRefreshingPrices(false);
    }
  };

  const handleClearAll = () => {
    if (confirm('¿Estás seguro que deseas eliminar todo el paquete cotizado?')) {
      localStorage.removeItem('quotedWindowsPackage');
      setStandaloneHardwareItems([]);
      setQuotedWindows([]);
      setProfileSummary([]);
      setHardwareSummary([]);
      setExtraCostsList([]);
    }
  };

  const handleRemoveWindow = (windowId: string) => {
    const updatedQuotes = quotedWindows.filter(quote => quote.id !== windowId);
    localStorage.setItem('quotedWindowsPackage', JSON.stringify(updatedQuotes));
    setQuotedWindows(updatedQuotes);
    calculateProfileSummary(updatedQuotes, profiles);
    calculateHardwareSummary(updatedQuotes, standaloneHardwareItems);
  };

  const handleAddExtraCost = () => {
    if (!newExtraCostName.trim() || newExtraCostAmount <= 0) {
      alert('Por favor ingrese un nombre válido y un monto mayor a 0');
      return;
    }

    const newExtraCost: ExtraCost = {
      id: crypto.randomUUID(),
      name: newExtraCostName.trim(),
      amount: newExtraCostAmount
    };

    setExtraCostsList(prev => [...prev, newExtraCost]);
    setNewExtraCostName('');
    setNewExtraCostAmount(0);
  };

  const handleRemoveExtraCost = (id: string) => {
    setExtraCostsList(prev => prev.filter(cost => cost.id !== id));
  };

  const handleRemoveAdditionalItem = (itemName: string) => {
    const itemToRemove = standaloneHardwareItems.find(item => item.name === itemName);
    if (!itemToRemove) return;

    if (confirm(`¿Estás seguro que deseas eliminar "${itemName}" (${itemToRemove.quantity} pz) del paquete?`)) {
      const updatedItems = standaloneHardwareItems.filter(item => item.name !== itemName);
      setStandaloneHardwareItems(updatedItems);

      const savedHardware = localStorage.getItem('windowHardware');
      let currentHardware: Hardware[] = [];
      if (savedHardware) {
        try {
          currentHardware = JSON.parse(savedHardware);
        } catch (error) {
          console.error('Error loading hardware:', error);
        }
      }

      calculateHardwareSummary(quotedWindows, updatedItems, currentHardware);
    }
  };

  const handleAddAdditionalItems = (items: SelectedItem[]) => {
    if (items.length === 0) return;
    
    // Agregar elementos adicionales al estado independiente
    const newStandaloneItems = [...standaloneHardwareItems];
    
    items.forEach(item => {
      const existingIndex = newStandaloneItems.findIndex(existing => existing.name === item.name);
      
      if (existingIndex >= 0) {
        // Si el elemento ya existe, actualizar cantidad
        newStandaloneItems[existingIndex].quantity += item.quantity;
      } else {
        // Si es un elemento nuevo, agregarlo
        newStandaloneItems.push({
          name: item.name,
          quantity: item.quantity,
          chargingMethod: item.chargingMethod,
          basePricePerPackage: item.basePricePerPackage,
          basePricePerPiece: item.basePricePerPiece,
          category: item.category
        });
      }
    });
    
    setStandaloneHardwareItems(newStandaloneItems);
    
    setShowAdditionalItemsModal(false);
    alert('¡Elementos adicionales agregados al paquete cotizado!');
  };

  // ✅ NUEVA FUNCIÓN PARA GUARDAR COTIZACIÓN
  const handleSaveQuote = (name: string) => {
    const totalFractionCost = profileSummary.reduce((sum, profile) => sum + profile.fractionCost, 0);
    const totalGrossCost = profileSummary.reduce((sum, profile) => sum + profile.grossCost, 0);
    const totalHardwareCost = hardwareSummary.reduce((sum, item) => sum + item.cost, 0);
    const totalExtraCosts = extraCostsList.reduce((sum, cost) => sum + cost.amount, 0);
    const totalWithProfit = (totalGrossCost + totalHardwareCost) * (1 + profitPercentage / 100) + totalExtraCosts;
    const ivaAmount = totalWithProfit * (userIvaPercentage / 100);
    const finalPriceWithIVA = totalWithProfit + ivaAmount;
    
    // Preparar los herrajes para incluirlos en el paquete
    const additionalHardwareItems = standaloneHardwareItems.map(item => ({
      name: item.name,
      pieces: item.quantity,
      cost: (() => {
        const { total } = calculateHardwareCostWithIVA(
          item.basePricePerPackage,
          item.basePricePerPiece,
          item.quantity,
          item.chargingMethod,
          materialIvaPercentage
        );
        return total;
      })()
    }));

    const quoteData = {
      id: crypto.randomUUID(),
      name,
      date: new Date().toISOString(),
      totalAmount: finalPriceWithIVA, // Usar precio final con IVA
      windowsCount: quotedWindows.length,
      profilesUsed: [...new Set(profileSummary.map(p => p.name))], // Perfiles únicos
      hardwareUsed: [...new Set(hardwareSummary.map(h => h.name))], // Herrajes únicos
      quotedWindows,
      profileSummary,
      hardwareSummary,
      extraCostsList,
      standaloneHardwareItems,
      totals: {
        fractionCost: totalFractionCost,
        grossCost: totalGrossCost + totalHardwareCost,
        hardwareCost: totalHardwareCost,
        profitPercentage: profitPercentage,
        finalPrice: totalWithProfit,
        extraCosts: totalExtraCosts,
        materialIvaPercentage: materialIvaPercentage,
        userIvaPercentage: userIvaPercentage,
        ivaAmount: ivaAmount,
        finalPriceWithIVA: finalPriceWithIVA
      }
    };

    const savedQuotes = JSON.parse(localStorage.getItem('savedQuotedPackages') || '[]');
    savedQuotes.push(quoteData);
    localStorage.setItem('savedQuotedPackages', JSON.stringify(savedQuotes));
    
    setShowSaveModal(false);
    alert('¡Cotización guardada exitosamente!');
  };

  // ✅ FUNCIÓN PARA RECALCULAR COSTOS DE VENTANAS CON PRECIOS ACTUALES Y IVA DE MATERIAL FIJO (16%)
  const recalculateWindowCosts = (windows: QuotedWindow[], profilesData: Profile[], hardwareData: any[]): QuotedWindow[] => {
    return windows.map(window => {
      const updatedProfiles = window.profiles.map(profile => {
        const realPrice = getProfilePriceWithIVA(profile.name, window.color, profilesData, materialIvaPercentage);
        const totalLengthInMeters = profile.totalLength / 100;
        const updatedCost = totalLengthInMeters * realPrice.pricePerM;

        return {
          ...profile,
          cost: updatedCost
        };
      });

      let updatedHardware = window.hardware;
      if (window.hardware && window.hardware.length > 0) {
        updatedHardware = window.hardware.map(item => {
          const hardwareInDB = hardwareData.find(h => h.name === item.name);
          if (hardwareInDB) {
            const basePricePerPiece = parseFloat(hardwareInDB.pricePerPiece) || 0;
            const { total } = calculateHardwareCostWithIVA(
              0,
              basePricePerPiece,
              item.pieces,
              'piece',
              materialIvaPercentage
            );
            return {
              ...item,
              cost: total
            };
          }
          return item;
        });
      }

      const newTotalCost = updatedProfiles.reduce((sum, p) => sum + p.cost, 0) +
                          (updatedHardware?.reduce((sum, h) => sum + h.cost, 0) || 0);

      return {
        ...window,
        profiles: updatedProfiles,
        hardware: updatedHardware,
        totalCost: newTotalCost
      };
    });
  };

  // ✅ NUEVA FUNCIÓN PARA CARGAR COTIZACIÓN CON ACTUALIZACIÓN AUTOMÁTICA DE PRECIOS
  const handleLoadQuote = (quote: any) => {
    const savedHardware = localStorage.getItem('windowHardware');
    let currentHardware: any[] = [];
    if (savedHardware) {
      try {
        currentHardware = JSON.parse(savedHardware);
      } catch (error) {
        console.error('Error loading hardware:', error);
      }
    }

    const updatedWindows = recalculateWindowCosts(quote.quotedWindows, profiles, currentHardware);

    localStorage.setItem('quotedWindowsPackage', JSON.stringify(updatedWindows));
    setQuotedWindows(updatedWindows);

    calculateProfileSummary(updatedWindows, profiles);
    calculateHardwareSummary(updatedWindows, quote.standaloneHardwareItems || [], currentHardware);

    setExtraCostsList(quote.extraCostsList || []);
    setStandaloneHardwareItems(quote.standaloneHardwareItems || []);

    if (quote.totals && typeof quote.totals.profitPercentage === 'number') {
      setProfitPercentage(quote.totals.profitPercentage);
    }

    if (quote.totals && typeof quote.totals.userIvaPercentage === 'number') {
      setUserIvaPercentage(quote.totals.userIvaPercentage);
    } else if (quote.totals && typeof quote.totals.ivaPercentage === 'number') {
      // Compatibilidad con cotizaciones antiguas
      setUserIvaPercentage(quote.totals.ivaPercentage);
    }

    setShowSavedQuotesModal(false);
    alert(`✅ Cotización "${quote.name}" cargada exitosamente!\n\n💡 Los precios han sido actualizados con los valores actuales de la base de datos.`);
  };

  const totalFractionCost = profileSummary.reduce((sum, profile) => sum + profile.fractionCost, 0);
  const totalGrossCost = profileSummary.reduce((sum, profile) => sum + profile.grossCost, 0);
  const totalHardwareCost = hardwareSummary.reduce((sum, item) => sum + item.cost, 0);
  const totalExtraCosts = extraCostsList.reduce((sum, cost) => sum + cost.amount, 0);

  // Use selected cost method for calculations
  const baseCost = selectedCostMethod === 'fraction' ? totalFractionCost : totalGrossCost;
  const totalWithProfit = (baseCost + totalHardwareCost) * (1 + profitPercentage / 100) + totalExtraCosts;
  const ivaAmount = totalWithProfit * (userIvaPercentage / 100);
  const finalPriceWithIVA = totalWithProfit + ivaAmount;

  // Calculate total square meters of all windows
  const totalSquareMeters = quotedWindows.reduce((sum, window) => {
    const width = parseFloat(window.width) || 0;
    const height = parseFloat(window.height) || 0;
    // Convert from cm to meters and calculate area
    const widthInMeters = width / 100;
    const heightInMeters = height / 100;
    const areaInSquareMeters = widthInMeters * heightInMeters;
    return sum + areaInSquareMeters;
  }, 0);

  // Group profiles by name for totals
  const profileTotals = profileSummary.reduce((acc, profile) => {
    if (!acc[profile.name]) {
      acc[profile.name] = {
        totalMeters: 0,
        totalPieces: 0,
        fractionCost: 0,
        grossCost: 0
      };
    }
    acc[profile.name].totalMeters += profile.totalMeters;
    acc[profile.name].totalPieces += profile.piecesNeeded;
    acc[profile.name].fractionCost += profile.fractionCost;
    acc[profile.name].grossCost += profile.grossCost;
    return acc;
  }, {} as Record<string, { totalMeters: number; totalPieces: number; fractionCost: number; grossCost: number }>);

  return (
    <div className="min-h-screen bg-[#003366] flex flex-col items-center px-4 animate-fade-in">
      <div className="w-full pt-6 px-6 flex justify-between items-center">
        <button
          onClick={onBack}
          className="text-white hover:text-gray-300 transition-colors"
          aria-label="Volver al menú anterior"
        >
          <ArrowLeft size={24} />
        </button>
        <div className="flex gap-2">
          {/* Botón para actualizar precios manualmente */}
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshingPrices}
            className="text-white hover:text-gray-300 transition-colors flex items-center gap-1 text-sm disabled:opacity-50"
            title="Actualizar precios desde la base de datos"
          >
            <RefreshCw size={16} className={isRefreshingPrices ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualizar Precios</span>
          </button>

          {/* Botón para ver cotizaciones guardadas */}
          <button
            onClick={() => setShowSavedQuotesModal(true)}
            className="text-white hover:text-gray-300 transition-colors flex items-center gap-1 text-sm"
          >
            <FolderOpen size={16} />
            <span className="hidden sm:inline">Ver Cotizaciones</span>
          </button>
          
          {/* Botón para agregar elementos adicionales */}
          {quotedWindows.length > 0 && (
            <button
              onClick={() => setShowAdditionalItemsModal(true)}
              className="bg-purple-500 text-white px-2 py-1 rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-1 text-sm"
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Adicionales</span>
            </button>
          )}
          
          {/* Botón para guardar cotización actual */}
          {quotedWindows.length > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="bg-green-500 text-white px-2 py-1 rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1 text-sm"
            >
              <Save size={16} />
              <span className="hidden sm:inline">Guardar</span>
              <span className="sm:hidden">G</span>
            </button>
          )}
          
          {/* Botón para limpiar todo */}
          {quotedWindows.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-white hover:text-red-300 transition-colors flex items-center gap-1 text-sm"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Limpiar</span>
            </button>
          )}
        </div>
      </div>

      <div className="text-center my-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Package size={48} className="text-white" />
          <h1 className="text-white text-5xl font-bold">PAQUETE COTIZADO</h1>
        </div>
        <div className="bg-white text-[#003366] px-6 py-2 rounded-full">
          <span className="font-bold">{quotedWindows.length} VENTANA{quotedWindows.length !== 1 ? 'S' : ''} AGREGADA{quotedWindows.length !== 1 ? 'S' : ''}</span>
        </div>

        {/* Notification banner for price updates */}
        {priceUpdateNotification && (
          <div className="mt-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg inline-block animate-fade-in">
            <span className="font-medium">✅ {priceUpdateNotification}</span>
          </div>
        )}

        {/* Last update timestamp */}
        {lastPriceUpdate && (
          <div className="mt-2 text-white text-sm opacity-75">
            Última actualización de precios: {lastPriceUpdate.toLocaleTimeString('es-MX')}
          </div>
        )}
      </div>

      <div className="w-full max-w-6xl">
        {quotedWindows.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <Package size={64} className="text-gray-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-600 mb-2">No hay ventanas en el paquete</h3>
            <p className="text-gray-500">Agrega ventanas desde las calculadoras de cotización</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Ventanas Agregadas */}
            <div className="bg-white rounded-lg p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-[#003366] mb-6 flex items-center gap-2">
                <Eye size={24} />
                Ventanas Agregadas
              </h2>
              
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {quotedWindows.map((window, index) => (
                  <div key={window.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-[#003366]">
                          Ventana #{index + 1} - {window.type}
                        </h3>
                        <p className="text-sm text-gray-600">{window.line}</p>
                        <p className="text-lg font-medium text-[#003366]">
                          {window.width} × {window.height} cm
                        </p>
                        <p className="text-sm text-gray-500">Color: {window.color}</p>
                        <p className="text-sm text-gray-500">
                          Método: {window.method === 'fraction' ? 'Por Fracción' : 'Bruto'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveWindow(window.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    
                    <div className="bg-gray-50 rounded p-3">
                      <h4 className="font-medium text-gray-700 mb-2">Perfiles utilizados:</h4>
                      <div className="space-y-1">
                        {window.profiles.map((profile, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>{profile.name}</span>
                            <span>{(profile.totalLength / 100).toFixed(2)}m - ${profile.cost.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      
                      {window.hardware && window.hardware.length > 0 && (
                        <>
                          <h4 className="font-medium text-gray-700 mt-3 mb-2">Componentes Adicionales:</h4>
                          <div className="space-y-1">
                            {window.hardware.map((item, idx) => (
                              <div key={idx} className="flex justify-between text-sm">
                                <span>{item.name}</span>
                                <span>{item.pieces} pz - ${item.cost.toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                      
                      <div className="border-t mt-2 pt-2 flex justify-between font-medium">
                        <span>Total:</span>
                        <span>${window.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOTALES DEL PAQUETE */}
            {profileSummary.length > 0 && (
              <div className="max-w-4xl mx-auto">
                  <div className="bg-[#003366] text-white rounded-lg p-6">
                    <h3 className="text-xl font-bold mb-4 text-center">TOTALES DEL PAQUETE</h3>
                    
                    {/* Resumen por tipo de perfil */}
                    <div className="space-y-3 mb-6">
                      {Object.entries(profileTotals).map(([profileName, totals]) => (
                        <div key={profileName} className="bg-blue-800 rounded-lg p-3">
                          <h4 className="font-bold text-lg mb-2">{profileName}</h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-blue-200">Por Fracción:</p>
                              <p className="font-bold">{totals.totalMeters.toFixed(2)} metros</p>
                              <p className="text-blue-200">${totals.fractionCost.toFixed(2)}</p>
                            </div>
                            <div>
                              <p className="text-blue-200">🎯 Bruto Real (Base de Datos):</p>
                              <p className="font-bold">{totals.totalPieces} pieza{totals.totalPieces !== 1 ? 's' : ''} de 6m</p>
                              <p className="text-green-300 font-bold">${totals.grossCost.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Componentes Adicionales */}
                    {hardwareSummary.length > 0 && (
                      <div className="border-t border-blue-400 pt-4 mb-6">
                        <div className="bg-blue-800 rounded-lg p-4">
                          <h4 className="font-bold text-lg mb-3 text-white">Componentes Adicionales</h4>
                          <div className="space-y-3">
                            {hardwareSummary.map((item, index) => (
                              <div key={index} className="flex justify-between items-center bg-blue-900 rounded-lg p-3">
                                <div>
                                  <p className="font-medium text-white">{item.name}</p>
                                  <p className="text-sm text-blue-200">{item.pieces} pieza{item.pieces !== 1 ? 's' : ''}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold text-green-300">${item.cost.toFixed(2)}</p>
                                  {standaloneHardwareItems.find(standalone => standalone.name === item.name) && (
                                    <button
                                      onClick={() => handleRemoveAdditionalItem(item.name)}
                                      className="text-red-400 hover:text-red-300 p-1"
                                      title="Eliminar componente"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Total square meters section */}
                    <div className="border-t border-blue-400 pt-4 mb-4">
                      <div className="text-center">
                        <p className="text-blue-200 text-lg font-medium">TOTAL METROS CUADRADOS:</p>
                        <p className="text-3xl font-bold text-yellow-300">{totalSquareMeters.toFixed(2)} m²</p>
                        <div className="text-sm text-blue-200 mt-1">
                          Suma de todas las ventanas del paquete
                        </div>
                      </div>
                    </div>

                    {/* Totales generales */}
                    <div className="border-t border-blue-400 pt-4">
                      {/* Selector de método de costo */}
                      <div className="mb-6">
                        <h4 className="text-blue-200 font-bold mb-3 text-center">SELECCIONAR MÉTODO DE COSTO:</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <button
                            onClick={() => setSelectedCostMethod('fraction')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              selectedCostMethod === 'fraction'
                                ? 'border-yellow-300 bg-yellow-100 bg-opacity-20'
                                : 'border-blue-400 hover:border-yellow-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-blue-200 font-medium">Por Fracción</span>
                              {selectedCostMethod === 'fraction' && (
                                <span className="text-yellow-300 text-xl">✓</span>
                              )}
                            </div>
                            <div className="text-2xl font-bold text-white">
                              ${(totalFractionCost + totalHardwareCost + totalExtraCosts).toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-200 mt-1">
                              Costo exacto según medidas
                            </div>
                          </button>
                          
                          <button
                            onClick={() => setSelectedCostMethod('gross')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                              selectedCostMethod === 'gross'
                                ? 'border-yellow-300 bg-yellow-100 bg-opacity-20'
                                : 'border-blue-400 hover:border-yellow-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-blue-200 font-medium">🎯 Bruto Real</span>
                              {selectedCostMethod === 'gross' && (
                                <span className="text-yellow-300 text-xl">✓</span>
                              )}
                            </div>
                            <div className="text-2xl font-bold text-green-300">
                              ${(totalGrossCost + totalHardwareCost + totalExtraCosts).toFixed(2)}
                            </div>
                            <div className="text-xs text-blue-200 mt-1">
                              Piezas completas de 6m
                            </div>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div className="text-center pt-4 border-t border-blue-400">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-blue-200">PORCENTAJE DE GANANCIA:</p>
                            <div className="flex items-center ml-2">
                              <input
                                type="number"
                                min="0"
                                max="1000"
                                value={profitPercentage === 0 ? '' : profitPercentage}
                                onChange={(e) => setProfitPercentage(Math.max(0, parseInt(e.target.value) || 0))}
                                className="w-14 px-1 py-1 bg-blue-700 text-white border border-blue-500 rounded text-right"
                              />
                              <span className="text-white ml-1">%</span>
                            </div>
                          </div>
                          
                          {/* Sección de costos extra */}
                          <div className="border-t border-blue-400 pt-4 mb-4">
                            <h4 className="text-blue-200 font-bold mb-3">COSTOS EXTRA (Flete, etc.):</h4>
                            <p className="text-sm text-blue-200 mt-1 mb-4">
                              💡 RECUERDA QUE LOS COSTOS ADICIONALES NO SE LE SUMA EL PORCENTAJE DE GANANCIA
                            </p>
                            
                            {/* Lista de costos extra */}
                            {extraCostsList.length > 0 && (
                              <div className="space-y-2 mb-4">
                                {extraCostsList.map((cost) => (
                                  <div key={cost.id} className="flex justify-between items-center p-2 bg-blue-800 rounded">
                                    <span className="text-white font-medium">{cost.name}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-white font-bold">${cost.amount.toFixed(2)}</span>
                                      <button
                                        onClick={() => handleRemoveExtraCost(cost.id)}
                                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Formulario para agregar nuevo costo extra */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
                              <input
                                type="text"
                                value={newExtraCostName}
                                onChange={(e) => setNewExtraCostName(e.target.value)}
                                className="px-2 py-1 bg-blue-700 text-white border border-blue-500 rounded placeholder-blue-300"
                                placeholder="Nombre del costo"
                              />
                              <div className="flex items-center">
                                <span className="text-blue-200 mr-1">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={newExtraCostAmount === 0 ? '' : newExtraCostAmount}
                                  onChange={(e) => setNewExtraCostAmount(parseFloat(e.target.value) || 0)}
                                  className="flex-1 px-2 py-1 bg-blue-700 text-white border border-blue-500 rounded placeholder-blue-300"
                                  placeholder="0.00"
                                />
                              </div>
                              <button
                                onClick={handleAddExtraCost}
                                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
                              >
                                <Plus size={14} />
                                Agregar
                              </button>
                            </div>

                            {/* Total de costos extra */}
                            <div className="flex justify-between items-center p-2 bg-blue-900 rounded">
                              <span className="text-blue-200 font-medium">Total Costos Extra:</span>
                              <span className="text-white font-bold">${totalExtraCosts.toFixed(2)}</span>
                            </div>
                          </div>
                          
                          <p className="text-3xl font-bold text-yellow-300 mt-2">PRECIO FINAL: ${totalWithProfit.toFixed(2)}</p>
                          <div className="text-sm text-blue-200 mt-1">
                            Incluye ${((baseCost + totalHardwareCost + totalExtraCosts) * (profitPercentage / 100)).toFixed(2)} de ganancia
                            {totalExtraCosts > 0 && ` + $${totalExtraCosts.toFixed(2)} de costos extra`}
                            <br />
                            <span className="text-yellow-300">
                              Método seleccionado: {selectedCostMethod === 'fraction' ? 'Por Fracción' : 'Bruto Real'}
                            </span>
                          </div>
                          
                          <div className="flex items-center justify-between mb-4 mt-4 pt-4 border-t border-blue-400">
                            <div>
                              <p className="text-blue-200 font-bold">IVA ADICIONAL:</p>
                              <p className="text-xs text-blue-300">Los materiales ya incluyen IVA del 16%</p>
                            </div>
                            <div className="flex items-center ml-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={userIvaPercentage === 0 ? '' : userIvaPercentage}
                                onChange={(e) => setUserIvaPercentage(Math.max(0, parseFloat(e.target.value) || 0))}
                                className="w-16 px-1 py-1 bg-blue-700 text-white border border-blue-500 rounded text-right"
                                placeholder="0.00"
                              />
                              <span className="text-white ml-1">%</span>
                            </div>
                          </div>

                          <div className="text-center">
                            <p className="text-blue-200">MONTO IVA ADICIONAL: ${ivaAmount.toFixed(2)}</p>
                            <p className="text-4xl font-bold text-green-300 mt-2">PRECIO FINAL CON IVA: ${finalPriceWithIVA.toFixed(2)}</p>
                            <div className="text-sm text-blue-200 mt-1">
                              Precio base: ${totalWithProfit.toFixed(2)} + IVA Adicional ({userIvaPercentage}%): ${ivaAmount.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        
                      </div>
                    </div>
                  </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modales */}
      {showSaveModal && (
        <SaveQuoteModal
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveQuote}
        />
      )}

      {showSavedQuotesModal && (
        <SavedQuotesModal
          onClose={() => setShowSavedQuotesModal(false)}
          onLoadQuote={handleLoadQuote}
        />
      )}

      {showAdditionalItemsModal && (
        <AddAdditionalItemsModal
          onClose={() => setShowAdditionalItemsModal(false)}
          onSaveAdditionalItems={handleAddAdditionalItems}
        />
      )}
    </div>
  );
}