export interface Expense {
  id: string;
  title: string;
  category: string;
  amount: number;
  expense_date: string;
  notes: string | null;
}

export interface ExpenseFormValues {
  title: string;
  category: string;
  amount: string;
  expense_date: string;
  notes: string;
}

export const EXPENSE_CATEGORIES = [
  { value: "hosting", label: "Hosting" },
  { value: "server_upgrade", label: "Server Upgrade" },
  { value: "plugins_software", label: "Plugins / Software" },
  { value: "website", label: "Website" },
  { value: "maintenance", label: "Maintenance" },
  { value: "other", label: "Other" },
] as const;

export const createEmptyExpenseForm = (): ExpenseFormValues => ({
  title: "",
  category: "hosting",
  amount: "",
  expense_date: getLocalDateString(),
  notes: "",
});

function getLocalDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
