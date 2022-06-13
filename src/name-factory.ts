import {
  Method,
  Parameter,
  Property,
  ReturnType,
  Service,
  Type,
} from 'basketry';
import { pascal, snake } from 'case';

import {
  buildEnumNamespace,
  buildNamespace,
  buildTypeNamespace,
} from '@basketry/sorbet/lib/name-factory';
import { RailsOptions } from './types';

export function buildFullyQualifiedType(
  type: Type,
  service: Service,
  options?: RailsOptions,
): string {
  return `${buildTypeNamespace(service, options)}::${pascal(type.name.value)}`;
}

export function buildFullyQualifiedValidationErrorType(
  service: Service,
  options?: RailsOptions,
): string {
  return `${buildValidationErrorNamespace(
    service,
    options,
  )}::${buildValidationErrorName()}`;
}
export function buildValidationErrorName(): string {
  return pascal(`validation_error`);
}
export function buildValidationErrorNamespace(
  service: Service,
  options?: RailsOptions,
): string {
  return buildNamespace(options?.sorbet?.typesModule, service, options);
}
export function buildValidationErrorFilepath(
  service: Service,
  options?: RailsOptions,
): string[] {
  const namespace = buildValidationErrorNamespace(service, options);

  return [
    ...namespace.split('::').map(snake),
    `${snake(buildValidationErrorName())}.rb`,
  ];
}

export function buildValidatorsName(): string {
  return pascal(`validators`);
}
export function buildValidatorsNamespace(
  service: Service,
  options?: RailsOptions,
): string {
  return buildNamespace(options?.sorbet?.interfacesModule, service, options);
}
export function buildValidatorsFilepath(
  service: Service,
  options?: RailsOptions,
): string[] {
  const namespace = buildValidatorsNamespace(service, options);

  return [
    ...namespace.split('::').map(snake),
    `${snake(buildValidatorsName())}.rb`,
  ];
}

export function buildMethodValidatorName(method: Method): string {
  return snake(`validate_${snake(method.name.value)}_parameters`);
}
