/* eslint-disable */

const app = require('./server');
const Promise = require('bluebird');

const promises = [];

// Roles, Usuarios
const User = app.models.MyUser;
const Role = app.models.Role;
const RoleMapping = app.models.RoleMapping;
const Config = app.models.Config

// admin
promises.push(
  new Promise((resolve, reject) => {
    console.log('Creando rol admin...');

    Role.findOrCreate(
      {
        where: {
          name: 'admin'
        }
      },
      {
        name: 'admin'
      },
      (err, role) => {
        if (err) reject(err);

        console.log('Rol admin creado, ahora creando usuario...');

        // Admin user
        User.findOrCreate(
          {
            where: {
              email: 'admin@imaginamos.com'
            }
          },
          {
            email: 'admin@imaginamos.com',
            password: 'colombia',
            emailVerified: true,
            username: 'admin'
          },
          (err, user) => {
            role.principals.create(
              {
                principalType: RoleMapping.USER,
                principalId: user.id
              },
              err => {
                if (err) reject(err);

                console.log('Usuario admin creado.');

                resolve();
              }
            );
          }
        );
      }
    );
    console.log('Creando configuraciones iniciales...');
    Config.findOrCreate(
      {
        where: {
          key: 'MIN_STOCK_TO_CHECK'
        }
      },
      {
        key: 'MIN_STOCK_TO_CHECK',
        value: `{"minStock": 10}`,
      },
      (err, config) => {
        console.log('Configuración creada.');
        console.log(config)
        resolve();
      }
    );
  })
);

// Todas las promesas
Promise.all(promises).finally(() => process.exit());
