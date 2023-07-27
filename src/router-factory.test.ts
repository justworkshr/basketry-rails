import { readFileSync } from 'fs';
import { join } from 'path';
import { generateTypes } from './router-factory';

const pkg = require('../package.json');
const withVersion = `${pkg.name}@${pkg.version}`;
const withoutVersion = `${pkg.name}@{{version}}`;

describe('InterfaceFactory', () => {
  it('recreates a valid snapshot', () => {
    // ARRANGE
    const service = require('basketry/lib/example-ir.json');

    // ACT
    const files = generateTypes(service, {
      sorbet: {
        typesModule: 'types',
        enumsModule: 'enums',
      },
    });

    // ASSERT
    for (const file of [...files]) {
      const path = join('src', 'snapshot', ...file.path);
      const snapshot = readFileSync(path)
        .toString()
        .replace(withoutVersion, withVersion);
      expect(file.contents).toStrictEqual(snapshot);
    }
  });

  describe('when the BaseControllerInterface is excluded', () => {
    it('does not generate the BaseControllerInterface file', () => {
      // ARRANGE
      const service = require('basketry/lib/example-ir.json');

      // ACT
      const files = generateTypes(service, {
        sorbet: {
          typesModule: 'types',
          enumsModule: 'enums',
        },
        basketry: {
          exclude: ['BaseControllerInterface'],
        },
      });

      // ASSERT
      files.forEach((file) => {
        expect(file.path).not.toEqual(
          expect.arrayContaining(['base_controller_interface.rb']),
        );
      });
    });
  });

  // when the ServiceController is excluded, it does not generate the ServiceController file
  describe('when the ServiceController is excluded', () => {
    it('does not generate the ServiceController file', () => {
      // ARRANGE
      const service = require('basketry/lib/example-ir.json');

      // ACT
      const files = generateTypes(service, {
        sorbet: {
          typesModule: 'types',
          enumsModule: 'enums',
        },
        basketry: {
          exclude: ['ServiceController'],
        },
      });

      // ASSERT
      files.forEach((file) => {
        expect(file.path[file.path.length - 1].endsWith('_controller.rb')).toBe(
          false,
        );
      });
    });
  });

  // when both the ServiceController and the BaseControllerInterface are excluded,
  // it does not generate the ServiceController file or the BaseControllerInterface file
  describe('when both the ServiceController and the BaseControllerInterface are excluded', () => {
    it('does not generate the ServiceController file or the BaseControllerInterface file', () => {
      // ARRANGE
      const service = require('basketry/lib/example-ir.json');

      // ACT
      const files = generateTypes(service, {
        sorbet: {
          typesModule: 'types',
          enumsModule: 'enums',
        },
        basketry: {
          exclude: ['ServiceController', 'BaseControllerInterface'],
        },
      });

      // ASSERT
      files.forEach((file) => {
        expect(file.path).not.toEqual(
          expect.arrayContaining(['base_controller_interface.rb']),
        );
        expect(file.path[file.path.length - 1].endsWith('_controller.rb')).toBe(
          false,
        );
      });
    });
  });
});
