// Inky Foldable & Responsive Store (matching Worklane src/store pattern)
import { create } from 'zustand';

export type ScreenPosture = 'flat' | 'folded' | 'dual';

interface FoldableState {
  isCoverScreen: boolean; // narrow cover screen (e.g. Z Fold cover < 450px)
  isUnfolded: boolean;    // wide near-square inner screen (e.g. Z Fold inner 600px - 1000px with ~1:1 aspect)
  isMobile: boolean;
  screenWidth: number;
  screenHeight: number;
  posture: ScreenPosture;

  // Actions
  updateDimensions: (width: number, height: number) => void;
}

export const useFoldableStore = create<FoldableState>((set) => ({
  isCoverScreen: typeof window !== 'undefined' ? window.innerWidth < 420 : false,
  isUnfolded: typeof window !== 'undefined' ? window.innerWidth >= 600 && window.innerWidth <= 1000 : false,
  isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
  screenHeight: typeof window !== 'undefined' ? window.innerHeight : 768,
  posture: 'flat',

  updateDimensions: (width, height) => {
    const isCoverScreen = width < 420;
    const isUnfolded = width >= 600 && width <= 1050 && Math.abs(width - height) < 350;
    const isMobile = width < 768;

    set({
      screenWidth: width,
      screenHeight: height,
      isCoverScreen,
      isUnfolded,
      isMobile,
    });
  },
}));
