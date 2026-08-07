// ============================================================
// GRUPPEKONFIGURASJON
// ============================================================
// Legg til / endre grupper her. "id" må være unik og bør ikke
// endres etter at gruppen har fått highscorer (da mister man
// koblingen til tidligere lagrede scorer).
//
// Passordet er en "ærlighetslås" - det gir ingen ekte sikkerhet,
// bare en enkel sperre mot at noen går inn i feil gruppe ved uhell.
// ============================================================

export const GROUPS = [
  {
    id: "res-sondag-8-11-gruppe-1",
    name: "RES søndag 8-11 år gruppe 1",
    password: "sondag1"
  },
  {
    id: "res-sondag-8-11-gruppe-2",
    name: "RES søndag 8-11 år gruppe 2",
    password: "sondag2"
  },
  {
    id: "res-torsdag-gruppe-1",
    name: "RES torsdag gruppe 1",
    password: "torsdag1"
  },
  {
    id: "res-fredag-gruppe-1",
    name: "RES fredag gruppe 1",
    password: "fredag1"
  }
  // Legg til flere grupper her etter samme mønster:
  // {
  //   id: "unik-id-uten-mellomrom",
  //   name: "Visningsnavn som vises i UI",
  //   password: "gruppepassord"
  // }
];

export function getGroupById(id) {
  return GROUPS.find((g) => g.id === id) || null;
}
