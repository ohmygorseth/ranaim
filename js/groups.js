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
    id: "fredag-fodt-2010-2013",
    name: "Fredag født 2010-2013",
    password: "fredag1"
  },
  {
    id: "fredag-fodt-2014-2017",
    name: "Fredag født 2014-2017",
    password: "fredag2"
  },
  {
    id: "sondag-counter-strike-2",
    name: "Søndag Counter Strike 2",
    password: "sondagcs2"
  },
  {
    id: "sondag-gr1-fodt-2014-2017",
    name: "Søndag gr 1 født 2014-2017",
    password: "sondag1"
  },
  {
    id: "sondag-gr2-fodt-2014-2017",
    name: "Søndag gr 2 født 2014-2017",
    password: "sondag2"
  },
  {
    id: "teknisk-og-trenere",
    name: "Teknisk og trenere",
    password: "teknisk"
  },
  {
    id: "torsdag-fodt-2010-2013",
    name: "Torsdag født 2010-2013",
    password: "torsdag1"
  },
  {
    id: "torsdag-fodt-2014-2017",
    name: "Torsdag født 2014-2017",
    password: "torsdag2"
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
