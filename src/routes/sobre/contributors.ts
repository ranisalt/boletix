export type Contributor = {
  readonly name: string;
  readonly url?: string;
};

/** People thanked on /sobre. The section stays hidden while the list is empty. */
export const CONTRIBUTORS: readonly Contributor[] = [
  { name: "Alexandre Werr", url: "https://twitter.com/AlexandreWerr" },
  { name: "Bruno Geronimo", url: "https://bruno.works/" },
  { name: "Isabela Andreotti" },
  { name: "Milena Siqueira" },
  { name: "Tamirys Pino" },
];
