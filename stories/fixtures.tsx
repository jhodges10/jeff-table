import type { DataGridColumnDef } from "../src";

export interface Person {
  avatar: string;
  balance: number;
  city: string;
  department: "Engineering" | "Finance" | "Operations" | "Sales";
  email: string;
  id: string;
  joined: string;
  name: string;
  status: "Active" | "Invited" | "Paused";
}

const firstNames = [
  "Ada",
  "Grace",
  "Linus",
  "Margaret",
  "Edsger",
  "Barbara",
  "Donald",
  "Radia",
  "James",
  "Anita",
] as const;
const lastNames = [
  "Lovelace",
  "Hopper",
  "Torvalds",
  "Hamilton",
  "Dijkstra",
  "Liskov",
  "Knuth",
  "Perlman",
  "Gosling",
  "Borg",
] as const;
const cities = ["Seattle", "Vancouver", "Portland", "Boston", "Austin"] as const;
const departments: Person["department"][] = ["Engineering", "Finance", "Operations", "Sales"];
const statuses: Person["status"][] = ["Active", "Invited", "Paused"];

export function makePeople(count: number, offset = 0): Person[] {
  return Array.from({ length: count }, (_, localIndex) => {
    const index = offset + localIndex;
    const first = firstNames[index % firstNames.length] ?? "User";
    const last = lastNames[(index * 3) % lastNames.length] ?? "Example";
    return {
      avatar: `${first[0]}${last[0]}`,
      balance: 1_250 + ((index * 7_919) % 98_000),
      city: cities[index % cities.length] ?? "Seattle",
      department: departments[index % departments.length] ?? "Engineering",
      email: `${first}.${last}.${index}@example.com`.toLocaleLowerCase(),
      id: `person-${index + 1}`,
      joined: new Date(2021 + (index % 5), index % 12, (index % 25) + 1)
        .toISOString()
        .slice(0, 10),
      name: `${first} ${last}`,
      status: statuses[index % statuses.length] ?? "Active",
    };
  });
}

export const people = makePeople(75);

export const personColumns: DataGridColumnDef<Person>[] = [
  {
    accessorKey: "avatar",
    enableHiding: false,
    enableSorting: false,
    header: () => <span className="jt-sr-only">Avatar</span>,
    meta: {
      headerAlign: "center",
      reorderable: false,
      skeleton: { shape: "circle", size: 28 },
      width: "56px",
    },
    cell: ({ getValue }) => <span className="story-avatar">{String(getValue())}</span>,
  },
  {
    accessorKey: "name",
    enableHiding: false,
    header: "Name",
    meta: {
      filter: { placeholder: "Find a name…", type: "text" },
      headerTooltip: "The record's primary display name",
      minWidth: 170,
      width: "minmax(170px, 1.2fr)",
    },
  },
  {
    accessorKey: "email",
    header: "Email",
    meta: { filter: { placeholder: "Find an email…", type: "text" }, minWidth: 220, width: "1.5fr" },
  },
  {
    accessorKey: "department",
    header: "Department",
    meta: {
      filter: {
        options: departments.map((value) => ({ label: value, value })),
        placeholder: "All teams",
        type: "multi-select",
      },
      width: "150px",
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      filter: {
        options: statuses.map((value) => ({ label: value, value })),
        placeholder: "Any status",
        type: "single-select",
      },
      width: "120px",
    },
    cell: ({ getValue }) => {
      const status = String(getValue());
      return <span className="story-status" data-status={status}>{status}</span>;
    },
  },
  {
    accessorKey: "city",
    header: "City",
    meta: { width: "120px" },
  },
  {
    accessorKey: "balance",
    header: "Balance",
    meta: {
      cellAlign: "right",
      filter: { format: "currency", min: 0, max: 100_000, step: 500, type: "number-range" },
      headerAlign: "right",
      numericSort: true,
      prefix: "$",
      width: "130px",
    },
    cell: ({ getValue }) =>
      Number(getValue()).toLocaleString("en-US", { style: "currency", currency: "USD" }),
  },
  {
    accessorKey: "joined",
    header: "Joined",
    meta: {
      filter: { type: "date-range" },
      width: "130px",
    },
  },
];
