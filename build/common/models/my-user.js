import * as Util from "../../server/utils";
import path from "path";
import { generateHtmlByEmailtemplate } from "../../server/functions/generate-html-by-email-template";
import { userSucces } from '../../integrations/mail/index';
import { Mailer } from "../../server/services/mailer";

import { uploadFile } from "../../server/functions/upload-file";

const Auth = require("../../server/services/auth");

module.exports = function (MyUser) {
  const myUserParam = MyUser;

  myUserParam.createUser = async (req) => {
    const { body } = req;

    let user = null;
    try {
      user = await myUserParam.findOne({
        where: {
          brandId: body.brandId,
          email: body.email,
        },
      });
    } catch (error) {
      throw error;
    }
    if (user) {
      if (body.email == body.uidAuth) {
        if (body.email == user.uidAuth) {
          let first = null;
          let last = null;
          if (body.name) {
            const firsAndlastName = body.name.split(" ");
            if (firsAndlastName.length === 4) {
              first = firsAndlastName[0] + " " + firsAndlastName[1];
              last =
                firsAndlastName[firsAndlastName.length - 2] +
                " " +
                firsAndlastName[firsAndlastName.length - 1];
            } else if (firsAndlastName.length === 3) {
              first = firsAndlastName[0] + " " + firsAndlastName[1];
              last = firsAndlastName[firsAndlastName.length - 1];
            } else if (firsAndlastName.length === 2) {
              first = firsAndlastName[0];
              last = firsAndlastName[firsAndlastName.length - 1];
            } else if (firsAndlastName.length === 1) {
              first = firsAndlastName[0];
            }
          }
          user.updateAttributes({
            phone: body.phone,
            firstName: first || body.name,
            lastName: last || body.name,
            identification: body.identification,
          });
          return user;
        } else {
          return "El usuario ya existe";
        }
      } else {
        return user;
      }
    } else {
      let first = null;
      let last = null;
      if (body.name) {
        const firsAndlastName = body.name.split(" ");
        if (firsAndlastName.length === 4) {
          first = firsAndlastName[0] + " " + firsAndlastName[1];
          last =
            firsAndlastName[firsAndlastName.length - 2] +
            " " +
            firsAndlastName[firsAndlastName.length - 1];
        } else if (firsAndlastName.length === 3) {
          first = firsAndlastName[0] + " " + firsAndlastName[1];
          last = firsAndlastName[firsAndlastName.length - 1];
        } else if (firsAndlastName.length === 2) {
          first = firsAndlastName[0];
          last = firsAndlastName[firsAndlastName.length - 1];
        } else if (firsAndlastName.length === 1) {
          first = firsAndlastName[0];
        }
      }

      let user = null;
      try {
        user = await myUserParam.create({
          brandId: body.brandId,
          uidAuth: body.uidAuth,
          provider: body.provider,
          phone: body.phone,
          firstName: first || body.name,
          lastName: last || body.name,
          email: body.email,
          birth: body.birth,
          docType: body.docType,
          identification: body.identification,
        });
      } catch (error) {
        throw error;
      }

      let url = {};
      try {
        if (body.brandId === 1) {
          url.url = "https://bmwmotorradshop.autogermana.com.co/mi-perfil";
        } else if (body.brandId === 2) {
          url.url = "https://bmwshop.autogermana.com.co/mi-perfil";
        } else if (body.brandId === 3) {
          url.url = "https://minishop.autogermana.com.co/mi-perfil";
        }
      } catch (error) {
        throw error;
      }

      const parametersEmail = {
        user: user,
        url: url,
      };

      if (user.email) {
        /* const html = generateHtmlByEmailtemplate('user-succes', parametersEmail) */

        // send the email
        /* const mailerObject = new Mailer() */
        try {
          const eventName = (brandId) => {
            switch (brandId) {
              case 1:
                return 'autorespuesta_motorrad_9_registro'

              case 2:
                return 'autorespuesta_mini_9_registro'

              case 3:
                return 'autorespuesta_bmw_9_registro'
            }
          }


          const linkProfile = (brandId) => {
            switch (brandId) {
              case 1:
                return 'https://bmwshop-autogermana.herokuapp.com/mi-perfil'

              case 2:
                return 'https://minishop-autogermana.herokuapp.com/mi-perfil'

              case 3:
                return 'https://bmwshop-autogermana.herokuapp.com/mi-perfil'
            }
          }

          const capitalize = (s) => {
            if (typeof s !== 'string') return ''
            return s.charAt(0).toUpperCase() + s.slice(1)
          }

          console.log(await userSucces({
            email: user.email,
            eventName: eventName(user.brandId),
            attributes: {
              name: capitalize(user.firstName),
              lastName: capitalize(user.lastName),
              userName: capitalize(user.firstName),
              urlPerfil: linkProfile(user.brandId),
              email: user.email,
            }
          }))

          /* await mailerObject.sendMail([user.email], html, 'Gracias por registrarse!') */
        } catch (error) {
          throw error
        }
      }
      return user;
    }
  };
  myUserParam.remoteMethod("createUser", {
    accepts: {
      arg: "req",
      type: "object",
      description:
        "{ brandId: 1, uidAuth: mFkDYK4rg8gYKEBMd5I7jnO6zbz1, provider: manual, name: segundo, email: develop@imaginamos.com }",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/createUser",
    },
    returns: {
      arg: "data",
      type: "Object",
      root: true,
    },
  });

  myUserParam.validateUser = async (req) => {
    const { body } = req;

    let user = null;
    try {
      user = await myUserParam.findOne({
        where: {
          brandId: body.brandId,
          email: body.email,
          provider: body.provider,
        },
      });
    } catch (error) {
      throw error;
    }

    if (body.brandId && body.email && body.provider) {
      if (user) {
        const result = {};
        result.isExist = true;
        result.provider = user.provider;
        return result;
      } else {
        const result = {};
        result.isExist = false;
        result.provider = body.provider;
        return result;
      }
    } else {
      throw new Error("Faltan parámetros en la petición");
    }
  };
  myUserParam.remoteMethod("validateUser", {
    accepts: {
      arg: "req",
      type: "object",
      description:
        "{ brandId: 1, uidAuth: mFkDYK4rg8gYKEBMd5I7jnO6zbz1, provider: manual, name: segundo }",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/validateUser",
    },
    returns: {
      arg: "data",
      type: "Object",
      root: true,
    },
  });

  myUserParam.updateUser = async (req) => {
    const { body } = req;
    // Valido que vengan los datos necesarios para cambiar la contraseña
    if (body.uidAuth && body.brandId) {
      let userInsta = null;
      try {
        userInsta = await myUserParam.findOne({
          where: {
            uidAuth: body.uidAuth,
            brandId: body.brandId,
          },
        });
      } catch (error) {
        throw error;
      }

      if (userInsta.email === body.email) {
        try {
          await userInsta.updateAttributes({
            lastName: body.lastName,
            firstName: body.firstName,
            docType: body.docType,
            phone: body.phone,
            identification: body.identification,
          });
        } catch (error) {
          throw error;
        }
      } else {
        let userValidateEmail = null;
        try {
          userValidateEmail = await myUserParam.findOne({
            where: {
              brandId: body.brandId,
              provider: userInsta.provider,
              email: body.email,
            },
          });
        } catch (error) {
          throw error;
        }
        if (!userValidateEmail) {
          try {
            await userInsta.updateAttributes({
              lastName: body.lastName,
              firstName: body.firstName,
              birth: body.birth,
              docType: body.docType,
              email: body.email,
              phone: body.phone,
              identification: body.identification,
            });
          } catch (error) {
            throw error;
          }

          if (body.provider === "manual") {
            try {
              await Auth.updateEmail(body.uidAuth, body.email);
            } catch (error) {
              Promise.reject(error);
            }
          }
        } else {
          throw new Error("Usuarío con el provider y email ya existe");
        }
      }

      return userInsta;
    } else {
      throw new Error("Faltan parámetros en la petición");
    }
  };
  myUserParam.remoteMethod("updateUser", {
    accepts: {
      arg: "req",
      type: "object",
      description:
        "{ brandId: 1, uidAuth: mFkDYK4rg8gYKEBMd5I7jnO6zbz1, provider: manual, name: segundo }",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/updateUser",
    },
    returns: {
      arg: "data",
      type: "Object",
      root: true,
    },
  });

  myUserParam.updatePasswordUser = async (req) => {
    const { body } = req;
    // Valido que vengan los datos necesarios para cambiar la contraseña
    if (body.uidAuth && body.brandId) {
      let userInsta = null;
      try {
        userInsta = await myUserParam.findOne({
          where: {
            uidAuth: body.uidAuth,
            brandId: body.brandId,
          },
        });
      } catch (error) {
        throw error;
      }
      if (userInsta) {
        try {
          await Auth.updateEmail(body.uidAuth, body.password);
        } catch (error) {
          Promise.reject(error);
        }
      }
      return userInsta;
    } else {
      throw new Error("Faltan parámetros en la petición");
    }
  };
  myUserParam.remoteMethod("updatePasswordUser", {
    accepts: {
      arg: "req",
      type: "object",
      description:
        "{ brandId: 1, uidAuth: mFkDYK4rg8gYKEBMd5I7jnO6zbz1, provider: manual, name: segundo }",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/updatePasswordUser",
    },
    returns: {
      arg: "data",
      type: "Object",
      root: true,
    },
  });

  myUserParam.updateAvatar = async (req, cb) => {
    const { MyUser } = myUserParam.app.models;
    try {
      const { fields, files } = await Util.getFormData(req);
      const { avatar } = files;
      const { userId } = fields;

      const user = await MyUser.findOne({
        where: {
          id: userId,
        },
      });

      const ext = path.extname(avatar.name);
      const destinationPath = `admin/images/avatars/${userId}${ext}`;

      const location = await uploadFile(avatar.path, destinationPath);

      return await user.updateAttributes({ avatar: location });
    } catch (error) {
      return cb(error);
    }
  };
  myUserParam.remoteMethod("updateAvatar", {
    description: "Actualización de avatar",
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    returns: { root: true, type: "object" },
    http: {
      verb: "post",
      path: "/updateAvatar",
    },
  });
};
