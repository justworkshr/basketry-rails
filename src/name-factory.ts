import {
  Method,
  Parameter,
  Property,
  ReturnType,
  Service,
  Type,
} from 'basketry';
import { pascal, snake } from 'case';

import { SorbetOptions } from '@basketry/sorbet/lib/types';
import {
  buildEnumNamespace,
  buildNamespace,
  buildTypeNamespace,
} from '@basketry/sorbet/lib/name-factory';

export function buildFullyQualifiedType(
  type: Type,
  service: Service,
  options?: SorbetOptions,
): string {
  return `${buildTypeNamespace(service, options)}::${pascal(type.name.value)}`;
}

export function buildFullyQualifiedValidationErrorType(
  service: Service,
  options?: SorbetOptions,
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
  options?: SorbetOptions,
): string {
  return buildNamespace(options?.sorbet?.typesModule, service, options);
}
export function buildValidationErrorFilepath(
  service: Service,
  options?: SorbetOptions,
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
  options?: SorbetOptions,
): string {
  return buildNamespace(options?.sorbet?.interfacesModule, service, options);
}
export function buildValidatorsFilepath(
  service: Service,
  options?: SorbetOptions,
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
