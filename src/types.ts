import { BasketryOptions, SorbetOptions } from '@basketry/sorbet/lib/types';

export type RailsOptions = {
  sorbet?: SorbetOptions & {
    baseController?: string;
  };
  basketry?: BasketryOptions;
};
