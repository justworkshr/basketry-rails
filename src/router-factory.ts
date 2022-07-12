import {
  allHttpPaths,
  File,
  Interface,
  Generator,
  Method,
  Service,
  Parameter,
  HttpPath,
  Primitive,
  HttpParameter,
  allParameters,
  getTypeByName,
  ReturnType,
  Type,
  Enum,
  allMethods,
  HttpMethod,
} from 'basketry';
import { pascal, sentence, snake } from 'case';
import { plural } from 'pluralize';

import { block, comment, from, indent } from './utils';

import {
  buildInterfaceName,
  buildInterfaceNamespace,
  buildPropertyName,
  buildServiceLocatorName,
  buildServiceLocatorNamespace,
  buildTypeName,
} from '@basketry/sorbet/lib/name-factory';
import { warning } from '@basketry/sorbet/lib/warning';
import { RailsOptions } from './types';

export const generateTypes: Generator = (service, options?: RailsOptions) => {
  return new Builder(service, options).build();
};

class Builder {
  constructor(
    private readonly service: Service,
    private readonly options?: RailsOptions,
  ) {}

  private readonly castPrimitive = new Set<Primitive>();
  private readonly castPrimitiveArray = new Set<Primitive>();

  build(): File[] {
    return [
      this.buildRouterFile(),
      ...this.service.interfaces.map((int) => this.buildControllerFile(int)),
      this.buildHelperFile(),
      this.buildBaseControllerInterfaceFile(),
    ];
  }
  private buildRouterFile(): File {
    return {
      path: [
        'config',
        'routes',
        `${snake(this.service.title.value)}_v${
          this.service.majorVersion.value
        }.rb`,
      ],
      contents: from(this.buildRouter()),
    };
  }

  private *buildRouter(): Iterable<string> {
    const self = this;
    yield warning(this.service, require('../package.json'));
    yield '';

    if (this.options?.sorbet?.magicComments?.length) {
      for (const magicComment of this.options.sorbet.magicComments) {
        yield `# ${magicComment}`;
      }
      yield '';
    }

    const versionModule = self.options?.sorbet?.includeVersion
      ? `module: 'v${this.service.majorVersion.value}', `
      : '';

    yield* block(
      `scope module: '${snake(this.service.title.value)}' do`,
      block(
        `scope ${versionModule}path: 'v${self.service.majorVersion.value}' do`,
        function* () {
          let first = true;
          for (const [group, paths] of groupPaths(
            allHttpPaths(self.service, self.service.sourcePath, self.options),
          )) {
            if (!first) yield '';
            yield `# ${sentence(group)}`;
            for (const { httpPath, interface: int } of sortPaths(paths)) {
              const path = `${paramify(httpPath.path.value)}`;

              for (const httpMethod of httpPath.methods) {
                const method = getMethodByName(
                  self.service,
                  httpMethod.name.value,
                );
                if (!method) continue;

                const verb = httpMethod.verb.value.toLowerCase();

                const controller = `${snake(plural(int.name))}#${snake(
                  method.name.value,
                )}`;

                yield `${verb} '${path}', to: '${controller}'`;
              }
            }
            first = false;
          }
        },
      ),
    );
    yield '';
  }

  private buildHelperFile(): File {
    return {
      path: [
        'app',
        'controllers',
        snake(this.service.title.value),
        this.options?.sorbet?.includeVersion
          ? `v${this.service.majorVersion.value}`
          : undefined,
        'controller_helpers.rb',
      ].filter((x): x is string => typeof x === 'string'),

      contents: from(this.buildHelper()),
    };
  }

  private *buildHelper(): Iterable<string> {
    const self = this;
    yield warning(this.service, require('../package.json'));
    yield '';

    if (this.options?.sorbet?.magicComments?.length) {
      for (const magicComment of this.options.sorbet.magicComments) {
        yield `# ${magicComment}`;
      }
      yield '';
    }
    const versionModule = self.options?.sorbet?.includeVersion
      ? `::V${this.service.majorVersion.value}`
      : '';
    yield* block(
      `module ${pascal(this.service.title.value)}${versionModule}`,

      block('module ControllerHelpers', function* () {
        let hasWritten = false;
        for (const type of self.service.types) {
          hasWritten ? yield '' : (hasWritten = true);
          const struct = self.buildFullyQualifiedTypeName(type);
          // DTO to struct
          yield `def map_dto_to_${snake(type.name.value)}(dto)`;
          yield* indent(function* () {
            yield `${struct}.new(`;
            yield* indent(
              type.properties.map((prop, i, arr) => {
                if (prop.isArray) {
                  return `${buildPropertyName(prop)}: dto['${
                    prop.name.value
                  }']&.map { |item| ${self.buildPropCast(
                    prop.typeName.value,
                    prop.isPrimitive,
                    `item`,
                  )} }${i < arr.length - 1 ? ',' : ''}`;
                } else {
                  return `${buildPropertyName(prop)}: ${self.buildPropCast(
                    prop.typeName.value,
                    prop.isPrimitive,
                    `dto['${prop.name.value}']`,
                  )}${i < arr.length - 1 ? ',' : ''}`;
                }
              }),
            );
            yield ')';
          });
          yield 'rescue StandardError';
          yield* indent('dto');
          yield 'end';

          // struct to DTO
          yield '';
          yield `def map_${snake(type.name.value)}_to_dto(${snake(
            type.name.value,
          )})`;
          yield* indent(function* () {
            yield `{`;
            yield* indent(
              type.properties.map((prop) => {
                if (prop.isArray) {
                  return `'${prop.name.value}': ${snake(
                    type.name.value,
                  )}.${buildPropertyName(
                    prop,
                  )}&.map { |item| ${self.buildDtoPropCast(
                    prop.typeName.value,
                    prop.isPrimitive,
                    `item`,
                  )} },`;
                } else {
                  return `'${prop.name.value}': ${self.buildDtoPropCast(
                    prop.typeName.value,
                    prop.isPrimitive,
                    `${snake(type.name.value)}.${buildPropertyName(prop)}`,
                  )},`;
                }
              }),
            );
            yield '}.compact';
          });
          yield 'rescue StandardError';
          yield* indent(snake(type.name.value));
          yield 'end';
        }
        for (const e of self.service.enums) {
          hasWritten ? yield '' : (hasWritten = true);
          // DTO to enum
          yield `def map_dto_to_${snake(e.name.value)}(dto)`;
          yield* indent(
            `${self.buildFullyQualifiedTypeName(e)}.deserialize(dto)`,
          );
          yield 'rescue StandardError';
          yield* indent('dto');
          yield 'end';
          // enum to DTO
          yield '';
          yield `def map_${snake(e.name.value)}_to_dto(enum)`;
          yield* indent(`enum&.serialize`);
          yield 'rescue StandardError';
          yield* indent('enum');
          yield 'end';
        }
        for (const primitive of self.castPrimitive) {
          hasWritten ? yield '' : (hasWritten = true);
          yield `def cast_${snake(primitive)}(param)`;
          yield* indent(
            `${self.buildPrimitiveCast(primitive, 'param')} if !param.nil?`,
          );
          yield 'rescue StandardError';
          yield* indent('param');
          yield 'end';
        }
        for (const primitive of self.castPrimitiveArray) {
          hasWritten ? yield '' : (hasWritten = true);
          yield `def cast_${snake(primitive)}_array(param)`;
          yield* indent(
            `param&.map { |item| ${self.buildPrimitiveCast(
              primitive,
              'item',
            )} if !item.nil? }`,
          );
          yield 'rescue StandardError';
          yield* indent('param');
          yield 'end';
        }
      }),
    );
    yield '';
  }

  private buildFullyQualifiedTypeName(type: Type | Enum) {
    return buildTypeName({
      type: {
        typeName: type.name,
        isPrimitive: false,
        isArray: false,
        rules: [],
      },
      service: this.service,
      options: this.options,
      skipArrayify: true,
    });
  }

  private buildPropCast(
    typeName: string,
    isPrimitive: boolean,
    baseCase: string,
  ): string {
    if (isPrimitive) {
      const override = this.options?.sorbet?.types?.[typeName];
      if (override) {
        return `${override}(${baseCase}.to_s)`;
      }

      const casted = this.buildPrimitiveCast(typeName as Primitive, baseCase);

      if (casted === baseCase) {
        return baseCase;
      } else {
        return `${baseCase}.is_a?(String) ? ${casted} : ${baseCase}`;
      }
    } else {
      return `map_dto_to_${snake(typeName)}(${baseCase})`;
    }
  }

  private buildDtoPropCast(
    typeName: string,
    isPrimitive: boolean,
    baseCase: string,
  ): string {
    if (isPrimitive) {
      switch (typeName as Primitive) {
        case 'date':
          return `${baseCase}&.to_s`;
        case 'date-time':
          return `${baseCase}&.utc&.iso8601`;
        default:
          return baseCase;
      }
    } else {
      return `map_${snake(typeName)}_to_dto(${baseCase})`;
    }
  }

  private buildPrimitiveCast(primitive: Primitive, baseCase: string): string {
    const override = this.options?.sorbet?.types?.[primitive];
    if (override) {
      return `${override}(${baseCase})`;
    }
    switch (primitive) {
      case 'boolean':
        return `ActiveModel::Type::Boolean.new.cast(${baseCase})`;
      case 'date':
        return `Date.parse(${baseCase})`;
      case 'date-time':
        return `DateTime.parse(${baseCase})`;
      case 'double':
      case 'float':
      case 'number':
        return `Float(${baseCase})`;
      case 'integer':
      case 'long':
        return `Integer(${baseCase}, 10)`;
      case 'null':
      case 'string':
      case 'untyped':
      default:
        return baseCase;
    }
  }

  private buildControllerFile(int: Interface): File {
    return {
      path: [
        'app',
        'controllers',
        snake(this.service.title.value),
        this.options?.sorbet?.includeVersion
          ? `v${this.service.majorVersion.value}`
          : undefined,
        `${snake(plural(int.name))}_controller.rb`,
      ].filter((x): x is string => typeof x === 'string'),
      contents: from(this.buildController(int)),
    };
  }

  private *buildController(int: Interface): Iterable<string> {
    const self = this;
    yield warning(this.service, require('../package.json'));
    yield '';

    if (this.options?.sorbet?.magicComments?.length) {
      for (const magicComment of this.options.sorbet.magicComments) {
        yield `# ${magicComment}`;
      }
      yield '';
    }

    const versionedModule = `${pascal(this.service.title.value)}${
      self.options?.sorbet?.includeVersion
        ? `::V${this.service.majorVersion.value}`
        : ''
    }`;

    yield* block(`module ${versionedModule}`, function* () {
      yield* block(
        `class ${pascal(plural(int.name))}Controller < ${
          self.options?.sorbet?.baseController || 'ApplicationController'
        }`,
        function* () {
          yield `include ${versionedModule}::ControllerHelpers`;
          for (const method of int.methods) {
            const httpMethod = getHttpMethod(self.service, method.name.value);
            if (!httpMethod) continue;
            yield '';
            yield* self.buildControllerMethod(method, httpMethod, int);
          }
        },
      );
    });

    yield '';
  }

  private *buildControllerMethod(
    method: Method,
    httpMethod: HttpMethod,
    int: Interface,
  ): Iterable<string> {
    const self = this;
    const methodName = snake(method.name.value);
    yield* block(`def ${methodName}`, function* () {
      yield `response = services.${snake(
        buildInterfaceName(int),
      )}.${methodName}(`;
      yield* indent(
        method.parameters.map(
          (param, i) =>
            `${snake(param.name.value)}: ${self.buildParamAccessor(
              method,
              param,
            )}${i === method.parameters.length - 1 ? '' : ','}`,
        ),
      );
      yield ')';
      yield '';
      const json = method.returnType
        ? `json: map_${snake(
            method.returnType.typeName.value,
          )}_to_dto(response), `
        : '';
      yield `render ${json}status: status_code(response.errors) || ${httpMethod.successCode.value}`;
    });
  }

  private buildParamAccessor(method: Method, param: Parameter): string {
    const httpParam = getHttpParameter(
      this.service,
      method.name.value,
      param.name.value,
    );
    const p = `params['${param.name.value}']`;

    if (httpParam?.in.value === 'body') {
      const type = getTypeByName(this.service, param.typeName.value);
      if (!type)
        return 'request.body.read.empty? ? nil : JSON.parse(request.body.read)';
      if (param.isArray) {
        return `request.body.read.empty? ? nil : JSON.parse(request.body.read).map { |item| map_dto_to_${snake(
          type.name.value,
        )}(item) }`;
      } else {
        return `map_dto_to_${snake(
          type.name.value,
        )}(request.body.read.empty? ? nil : JSON.parse(request.body.read))`;
      }
    }

    if (param.isPrimitive) {
      switch (param.typeName.value) {
        case 'null':
        case 'string':
        case 'untyped':
          return param.isArray ? `${p}&.split('${seperator(httpParam)}')` : p;
        default:
          const m = ['cast', snake(param.typeName.value)];
          if (param.isArray) {
            m.push('array');
            this.castPrimitiveArray.add(param.typeName.value);
            return `${m.join('_')}(${p}&.split('${seperator(httpParam)}'))`;
          } else {
            this.castPrimitive.add(param.typeName.value);
            return `${m.join('_')}(${p})`;
          }
      }
    } else {
      return `${p}`;
    }
  }

  private buildBaseControllerInterfaceFile(): File {
    return {
      path: [
        'app',
        'controllers',
        snake(this.service.title.value),
        this.options?.sorbet?.includeVersion
          ? `v${this.service.majorVersion.value}`
          : undefined,
        `base_controller_interface.rb`,
      ].filter((x): x is string => typeof x === 'string'),
      contents: from(this.buildBaseControllerInterface()),
    };
  }

  private *buildBaseControllerInterface(): Iterable<string> {
    const self = this;
    yield warning(this.service, require('../package.json'));
    yield '';

    if (this.options?.sorbet?.magicComments?.length) {
      for (const magicComment of this.options.sorbet.magicComments) {
        yield `# ${magicComment}`;
      }
      yield '';
    }

    yield '# typed: strict';
    yield '';

    const names = Array.from(
      new Set(
        allMethods(this.service, '', this.options)
          .map((m) => m.method.returnType)
          .filter((r): r is ReturnType => !!r)
          .map((r) => getTypeByName(this.service, r.typeName.value))
          .filter((t): t is Type => !!t)
          .map(
            (t) =>
              t.properties.find(
                (p) => p.isArray && p.name.value.toLowerCase() === 'errors',
              )?.typeName?.value,
          )
          .filter((n): n is string => !!n),
      ),
    )
      .map((n) => {
        const type = getTypeByName(this.service, n);

        return type
          ? buildTypeName({
              type: {
                typeName: type.name,
                isArray: false,
                isPrimitive: false,
                rules: [],
              },
              service: this.service,
              options: this.options,
              skipArrayify: true,
            })
          : undefined;
      })
      .filter((n): n is string => !!n);

    const errorType =
      names.length === 0
        ? 'T.untyped'
        : names.length === 1
        ? names[0]
        : `T.any(${names.join(', ')})`;

    const versionedModule = `${pascal(this.service.title.value)}${
      self.options?.sorbet?.includeVersion
        ? `::V${this.service.majorVersion.value}`
        : ''
    }`;
    const interfaceName = 'BaseControllerInterface';
    yield* block(`module ${versionedModule}`, function* () {
      yield* block(`module ${interfaceName}`, function* () {
        yield `extend T::Sig`;
        yield `extend T::Helpers`;
        yield '';
        yield 'interface!';
        yield '';
        yield `sig { abstract.returns(${buildServiceLocatorNamespace(
          self.service,
          self.options,
        )}::${buildServiceLocatorName()}) }`;
        yield 'def services';
        yield 'end';
        yield '';
        yield `sig { abstract.params(errors: T::Array[${errorType}]).returns(T.nilable(Integer)) }`;
        yield 'def status_code(errors)';
        yield 'end';
      });
    });

    yield '';
    yield `# The following template can be used to create an implementation of ${interfaceName}.`;
    yield `# Note that if the original service definition is updated, this template may also be`;
    yield `# updated; however, your implementation will remain as-is. In such a case, you will need`;
    yield `# to manually update your implementation to match the ${interfaceName} interface.`;
    yield '';

    yield* comment(function* () {
      yield* block(
        `class BaseController < ApplicationController`,
        function* () {
          yield `extend T::Sig`;
          yield '';
          yield `include ${versionedModule}::${interfaceName}`;
          yield '';
          yield `sig { override.returns(${buildServiceLocatorNamespace(
            self.service,
            self.options,
          )}::${buildServiceLocatorName()}) }`;
          yield 'def services';
          yield* indent('raise NotImplementedError');
          yield 'end';
          yield '';
          yield `sig { override.params(errors: T::Array[${errorType}]).returns(T.nilable(Integer)) }`;
          yield 'def status_code(errors)';
          yield* indent('raise NotImplementedError');
          yield 'end';
        },
      );
    });

    yield '';
  }
}

function seperator(httpParam: HttpParameter | undefined) {
  switch (httpParam?.array?.value) {
    case 'pipes':
      return '|';
    case 'ssv':
      return ' ';
    case 'tsv':
      return '\t';
    default:
      return ',';
  }
}

/** Groups routes by their first segment */
function groupPaths<T extends { httpPath: HttpPath }>(
  items: T[],
): Map<string, T[]> {
  const groups: Map<string, T[]> = new Map();

  for (const item of items) {
    const first = item.httpPath.path.value.split('/').filter((x) => x)[0];

    if (!groups.has(first)) groups.set(first, []);
    groups.get(first)!.push(item);
  }

  return groups;
}

/** Sorts paths such that the most specific route is drawn first. */
function sortPaths<T extends { httpPath: HttpPath }>(items: T[]): T[] {
  return [...items].sort((pathA, pathB) => {
    const segsA = paramify(pathA.httpPath.path.value).split('/');
    const segsB = paramify(pathB.httpPath.path.value).split('/');
    const len = segsA.length > segsB.length ? segsA.length : segsB.length;

    for (let i = 0; i < len; i++) {
      const a = segsA[i];
      const b = segsB[i];

      if (a === b) continue;
      if (a === undefined) return 1; // b (more specific route) comes first
      if (b === undefined) return -1; // a (more specific route) comes first
      if (a.startsWith(':')) return -1; // a (path param) comes first
      if (b.startsWith(':')) return 1; // b (path param) comes first
      return a.localeCompare(b); // routes are different, so sort by alpha
    }

    return 0; // routes are identical
  });
}

/** Converts route params to the :param format used by rails */
function paramify(path: string): string {
  return path
    .split('/')
    .map((segment) =>
      segment.startsWith('{') && segment.endsWith('}')
        ? `:${segment.substring(1, segment.length - 1)}`
        : segment,
    )
    .filter((x) => !!x)
    .join('/');
}

// TODO: move to basketry
const methodCache = new WeakMap<Service, Map<string, Method>>();
function getMethodByName(service: Service, name: string): Method | undefined {
  if (!methodCache.has(service)) {
    const map = new Map<string, Method>();

    service.interfaces
      .flatMap((i) => i.methods)
      .forEach((m) => map.set(snake(m.name.value), m));

    methodCache.set(service, map);
  }

  return methodCache.get(service)!.get(snake(name));
}

// TODO: move to basketry
const httpParameterCache = new WeakMap<Service, Map<string, HttpParameter>>();
function getHttpParameter(
  service: Service,
  methodName: string,
  parameterName: string,
): HttpParameter | undefined {
  const key = (m: string, p: string): string => `${snake(m)}|||${snake(p)}`;

  if (!httpParameterCache.has(service)) {
    const map = new Map<string, HttpParameter>();

    for (const { method, httpParameter } of allParameters(
      service,
      '',
      undefined,
    )) {
      if (!httpParameter) continue;
      map.set(key(method.name.value, httpParameter.name.value), httpParameter);
    }
    httpParameterCache.set(service, map);
  }

  return httpParameterCache.get(service)!.get(key(methodName, parameterName));
}

// TODO: move to basketry
const httpMethodCache = new WeakMap<Service, Map<string, HttpMethod>>();
function getHttpMethod(
  service: Service,
  methodName: string,
): HttpMethod | undefined {
  const key = (m: string, p: string): string => `${snake(m)}|||${snake(p)}`;

  if (!httpMethodCache.has(service)) {
    const map = new Map<string, HttpMethod>();

    for (const { method, httpMethod } of allMethods(service, '', undefined)) {
      if (!httpMethod) continue;
      map.set(key(method.name.value, httpMethod.name.value), httpMethod);
    }
    httpMethodCache.set(service, map);
  }

  return httpMethodCache.get(service)!.get(key(methodName, methodName));
}
