export interface Species {
  id: string;
  assembly: string;
  chromosomes: { name: string; length: number }[];
}

export interface Sample {
  id: string;
  species: string;
  tissue: string;
  breed: string;
  sex: string;
  individual: number;
  dev_stage: string;
}