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
  onCall: boolean;
  skills: string[];
  status: "Active" | "Invited" | "Paused";
  verified: boolean;
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
const skills = ["Design", "Infra", "Mobile", "Research", "Security"] as const;

export const departmentOptions = departments.map((value) => ({ label: value, value }));
export const statusOptions = statuses.map((value) => ({ label: value, value }));
export const skillOptions = skills.map((value) => ({ label: value, value }));

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
      joined: new Date(2021 + (index % 5), index % 12, (index % 25) + 1).toISOString().slice(0, 10),
      name: `${first} ${last}`,
      onCall: index % 3 === 0,
      skills: [skills[index % skills.length] ?? "Design"],
      status: statuses[index % statuses.length] ?? "Active",
      verified: index % 4 !== 0,
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
    meta: {
      filter: { placeholder: "Find an email…", type: "text" },
      minWidth: 220,
      width: "1.5fr",
    },
  },
  {
    accessorKey: "department",
    header: "Department",
    meta: {
      filter: { options: departmentOptions, placeholder: "All teams", type: "multi-select" },
      width: "150px",
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    meta: {
      filter: { options: statusOptions, placeholder: "Any status", type: "single-select" },
      renderValue: (status) => (
        <span className="story-status" data-status={status}>
          {status}
        </span>
      ),
      width: "120px",
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
      numberFormat: { currency: "USD", locale: "en-US" },
      numericSort: true,
      width: "130px",
    },
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

/**
 * The same columns, made editable.
 *
 * `status` deliberately declares no editor options: a select editor falls back
 * to the column's filter options, so a column that already says what it can be
 * filtered by does not repeat itself to say what it can be edited to.
 */
export const editablePersonColumns: DataGridColumnDef<Person>[] = [
  ...personColumns.map((column) => {
    const accessor = "accessorKey" in column ? column.accessorKey : undefined;
    if (accessor === "name" || accessor === "email" || accessor === "city") {
      return { ...column, meta: { ...column.meta, editor: { type: "text" as const } } };
    }
    if (accessor === "balance") {
      return {
        ...column,
        meta: { ...column.meta, editor: { min: 0, step: 250, type: "number" as const } },
      };
    }
    if (accessor === "department") {
      return {
        ...column,
        meta: {
          ...column.meta,
          editor: { options: departmentOptions, type: "multi-select" as const },
        },
      };
    }
    if (accessor === "status") {
      return { ...column, meta: { ...column.meta, editor: { type: "single-select" as const } } };
    }
    if (accessor === "joined") {
      return { ...column, meta: { ...column.meta, editor: { type: "date" as const } } };
    }
    return column;
  }),
  {
    accessorKey: "skills",
    header: "Skills",
    enableSorting: false,
    meta: {
      editor: { options: skillOptions, placeholder: "Add a skill…", type: "multi-select" },
      minWidth: 160,
      renderValue: (skill) => <span className="story-tag">{skill}</span>,
      width: "minmax(160px, 1fr)",
    },
  },
  {
    accessorKey: "onCall",
    header: "On call",
    enableSorting: false,
    meta: { cellAlign: "center", editor: { type: "boolean" }, width: "90px" },
  },
  {
    accessorKey: "verified",
    header: "Verified",
    enableSorting: false,
    // The same data type, the other control: a checkbox reads as a value in a
    // record where the switch beside it reads as a setting.
    meta: {
      cellAlign: "center",
      editor: { control: "checkbox", type: "boolean" },
      width: "90px",
    },
  },
];
