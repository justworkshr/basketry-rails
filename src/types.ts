import { SorbetOptions } from '@basketry/sorbet/lib/types';

export type RailsOptions = {
  sorbet?: SorbetOptions & {
    baseController?: string;
  };
};
