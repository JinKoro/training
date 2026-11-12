export type Macros = [number, number, number]; // P, F, C grams

export interface Me {
  user: { id: number; email: string; theme: 'system' | 'light' | 'dark'; goal: 'lose' | 'keep' | 'gain'; createdAt: number };
  profile: { name: string | null; weight: number | null; height: number | null; birthDate: string | null; steps: number | null };
  norms: { from: string; type: 'training' | 'rest'; macros: Macros }[];
}

export interface Exercise {
  id: number; own: boolean; name: string; type: 'weight_reps' | 'time'; kind: string | null; group: string | null;
  subtitle: string | null; primary: string[]; secondary: string[]; description: string | null; steps: string[]; rest: number;
}

export interface PlanRow { exerciseId: number; sets: number; reps: string; kg: string; rest?: number | null; note?: string | null }
export type Plan = Record<string, Record<string, PlanRow[]>>;

export interface Program {
  id: number; name: string; weekdays: number[]; weeks: number; startDate: string; active: boolean; plan: Plan;
  createdAt: number; updatedAt: number;
}

export interface WSet { index: number; plannedWeight: number | null; plannedReps: number; weight: number | null; reps: number | null; completedAt: number | null }
export interface WExercise { position: number; exerciseId: number | null; name: string; kind: string | null; muscles: string | null; type: string; rest: number; skippedAt: number | null; sets: WSet[] }
export interface Workout {
  id: number; programId: number | null; week: number | null; weekday: number | null; title: string; date: string;
  status: 'in_progress' | 'finished'; startedAt: number; finishedAt: number | null; exercises: WExercise[];
}

export type Meal = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export interface FoodItem {
  type: 'product' | 'dish'; id: number; name: string; protein: number; fat: number; carbs: number;
  portionName: string | null; portionG: number | null; icon: string; barcode?: string | null; cookedWeight?: number;
}
export interface Entry {
  id: number; date: string; meal: Meal; position: number; productId: number | null; dishId: number | null; grams: number;
  portions: number | null; name: string; icon: string; protein: number; fat: number; carbs: number; portionName: string | null; portionG: number | null;
}
