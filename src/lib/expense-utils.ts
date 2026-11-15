import { EXPENSE_CATEGORIES } from "../types/expense";

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);

export const formatExpenseDate = (value: string) => {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const getExpenseCategoryLabel = (value: string) =>
  EXPENSE_CATEGORIES.find((category) => category.value === value)?.label ??
  value;
