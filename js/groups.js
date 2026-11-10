// ============================================================
// GRUPPEKONFIGURASJON
// ============================================================
// Legg til / endre grupper her. "id" må være unik og bør ikke
// endres etter at gruppen har fått highscorer (da mister man
// koblingen til tidligere lagrede scorer).
//
// name:   fullt navn, brukes i hub og highscore
// label:  kort navn på knappen i gruppevalget (dagen står som overskrift)
// day:    "Søndag", "Torsdag", "Fredag" eller "Teknisk"
//
// Passordet er en "ærlighetslås" - det gir ingen ekte sikkerhet,
// bare en enkel sperre mot at noen går inn i feil gruppe ved uhell.
// ============================================================

export const GROUPS = [
  {
    id: "sondag-counter-strike-2",
    name: "Søndag Counter Strike 2",
    label: "Counter Strike 2",
    day: "Søndag",
    password: "crosshair"
  },
  {
    id: "sondag-gr1-fodt-2014-2017",
    name: "Søndag gr 1 født 2014-2017",
    label: "Gr 1 født 2014-2017",
    day: "Søndag",
    password: "noob"
  },
  {
    id: "sondag-gr2-fodt-2014-2017",
    name: "Søndag gr 2 født 2014-2017",
    label: "Gr 2 født 2014-2017",
    day: "Søndag",
    password: "bhop"
  },
  {
    id: "torsdag-fodt-2010-2013",
    name: "Torsdag født 2010-2013",
    label: "Født 2010-2013",
    day: "Torsdag",
    password: "wasd"
  },
  {
    id: "torsdag-fodt-2014-2017",
    name: "Torsdag født 2014-2017",
    label: "Født 2014-2017",
    day: "Torsdag",
    password: "dpi"
  },
  {
    id: "fredag-fodt-2010-2013",
    name: "Fredag født 2010-2013",
    label: "Født 2010-2013",
    day: "Fredag",
    password: "strafe"
  },
  {
    id: "fredag-fodt-2014-2017",
    name: "Fredag født 2014-2017",
    label: "Født 2014-2017",
    day: "Fredag",
    password: "flick"
  },
  {
    id: "teknisk-og-trenere",
    name: "Teknisk og trenere",
    label: "Teknisk og trenere",
    day: "Teknisk",
    password: "sens"
  }
  // Legg til flere grupper her etter samme mønster:
  // {
  //   id: "unik-id-uten-mellomrom",
  //   name: "Fullt navn",
  //   label: "Kort navn på knappen",
  //   day: "Søndag",
  //   password: "gruppepassord"
  // }
];

export function getGroupById(id) {
  return GROUPS.find((g) => g.id === id) || null;
}
