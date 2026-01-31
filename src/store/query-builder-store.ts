import { create } from 'zustand';
import type {
  QueryModel,
  TableRef,
  ColumnRef,
  JoinRef,
  ConditionGroup,
  OrderRef,
  Condition,
} from '../domain/query-builder-types';
import { createEmptyQueryModel, createEmptyConditionGroup } from '../domain/query-builder-types';

interface QueryBuilderState {
  isOpen: boolean;
  model: QueryModel;

  // Actions
  open: () => void;
  close: () => void;
  reset: () => void;
  
  // Model mutations
  setFromTable: (table: TableRef) => void;
  addJoin: (join: JoinRef) => void;
  removeJoin: (index: number) => void;
  updateJoin: (index: number, join: JoinRef) => void;
  
  addColumn: (column: ColumnRef) => void;
  removeColumn: (index: number) => void;
  toggleColumn: (column: ColumnRef) => void;
  
  setWhere: (where: ConditionGroup) => void;
  addCondition: (condition: Condition) => void;
  removeCondition: (index: number) => void;
  
  addGroupBy: (column: ColumnRef) => void;
  removeGroupBy: (index: number) => void;
  
  addOrderBy: (order: OrderRef) => void;
  removeOrderBy: (index: number) => void;
  updateOrderBy: (index: number, order: OrderRef) => void;
  
  setLimit: (limit: number | undefined) => void;
}

export const useQueryBuilderStore = create<QueryBuilderState>((set) => ({
  isOpen: false,
  model: createEmptyQueryModel(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  reset: () => set({ model: createEmptyQueryModel() }),

  setFromTable: (table) =>
    set((state) => ({
      model: { ...state.model, from: table },
    })),

  addJoin: (join) =>
    set((state) => ({
      model: { ...state.model, joins: [...state.model.joins, join] },
    })),

  removeJoin: (index) =>
    set((state) => ({
      model: {
        ...state.model,
        joins: state.model.joins.filter((_, i) => i !== index),
      },
    })),

  updateJoin: (index, join) =>
    set((state) => ({
      model: {
        ...state.model,
        joins: state.model.joins.map((j, i) => (i === index ? join : j)),
      },
    })),

  addColumn: (column) =>
    set((state) => ({
      model: { ...state.model, select: [...state.model.select, column] },
    })),

  removeColumn: (index) =>
    set((state) => ({
      model: {
        ...state.model,
        select: state.model.select.filter((_, i) => i !== index),
      },
    })),

  toggleColumn: (column) =>
    set((state) => {
      const exists = state.model.select.some(
        (c) => c.table === column.table && c.column === column.column
      );
      
      if (exists) {
        return {
          model: {
            ...state.model,
            select: state.model.select.filter(
              (c) => !(c.table === column.table && c.column === column.column)
            ),
          },
        };
      } else {
        return {
          model: {
            ...state.model,
            select: [...state.model.select, column],
          },
        };
      }
    }),

  setWhere: (where) =>
    set((state) => ({
      model: { ...state.model, where },
    })),

  addCondition: (condition) =>
    set((state) => {
      const where = state.model.where || createEmptyConditionGroup();
      return {
        model: {
          ...state.model,
          where: {
            ...where,
            conditions: [...where.conditions, condition],
          },
        },
      };
    }),

  removeCondition: (index) =>
    set((state) => {
      if (!state.model.where) return state;
      return {
        model: {
          ...state.model,
          where: {
            ...state.model.where,
            conditions: state.model.where.conditions.filter((_, i) => i !== index),
          },
        },
      };
    }),

  addGroupBy: (column) =>
    set((state) => ({
      model: { ...state.model, groupBy: [...state.model.groupBy, column] },
    })),

  removeGroupBy: (index) =>
    set((state) => ({
      model: {
        ...state.model,
        groupBy: state.model.groupBy.filter((_, i) => i !== index),
      },
    })),

  addOrderBy: (order) =>
    set((state) => ({
      model: { ...state.model, orderBy: [...state.model.orderBy, order] },
    })),

  removeOrderBy: (index) =>
    set((state) => ({
      model: {
        ...state.model,
        orderBy: state.model.orderBy.filter((_, i) => i !== index),
      },
    })),

  updateOrderBy: (index, order) =>
    set((state) => ({
      model: {
        ...state.model,
        orderBy: state.model.orderBy.map((o, i) => (i === index ? order : o)),
      },
    })),

  setLimit: (limit) =>
    set((state) => ({
      model: { ...state.model, limit },
    })),
}));
