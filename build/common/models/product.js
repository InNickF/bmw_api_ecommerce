import slug from "slug";
import * as autogermanaIntegration from "../../integrations/autogermana";
import getParameterValue from "../../server/functions/get-parameter-value";
import { model } from "../constans/models";
import { promises } from "dns";
import { rest } from "loopback";
const integrationMail = require("../../integrations/mail");
const throat = require("throat");
const s3tree = require("s3-tree");
const aws = require("aws-sdk");
const fs = require("fs");

const s3 = new aws.S3({ apiVersion: "2006-03-01" });

const generator = s3tree({ bucket: "autogermana", s3 });

aws.config.update({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

module.exports = function (Product) {
  const productParam = Product;

  productParam.observe("before save", async (ctx) => {
    if (ctx.isNewInstance) {
      ctx.instance.slug = slug(
        ctx.instance.name.toLowerCase() + "-" + ctx.instance.sku
      );
    } else {
      // ctx.data.slug = slug(`${ctx.data.name.toLowerCase()}-${ctx.data.sku}`)
      // ctx.data.slug = slug(ctx.data.name.toLowerCase() + '-' + ctx.data.sku)
      // slug(`${product.Nombre.toLowerCase()}-${product.sku}`),
    }
    return Promise.resolve();
  });

  productParam.validatesPresenceOf("stock", {
    message: {
      labels: "El campo existencias es requerido",
      field: "The stock is required",
    },
  });
  productParam.validatesPresenceOf("sku", {
    message: {
      labels: "El campo sku es requerido",
      field: "The sku is required",
    },
  });
  productParam.validatesPresenceOf("installation", {
    message: {
      labels: "El campo instalación es requerido",
      field: "The installation is required",
    },
  });
  productParam.validatesPresenceOf("active", {
    message: {
      labels: "El campo estado del producto es requerido",
      field: "The active is required",
    },
  });
  productParam.validatesPresenceOf("deplete", {
    message: {
      labels: "El campo existencias a agostar es requerido",
      field: "The deplete is required",
    },
  });

  // Crea los productos de la lista
  productParam.handleProductsAutogermana = async (sku) => {
    let productsFromAutogermana = [];
    try {
      productsFromAutogermana = await autogermanaIntegration.getProducts(sku);
    } catch (error) {
      throw error;
    }

    const {
      ProductCategory,
      VehicleType,
      Brand,
      VehicleSerie,
      VehicleModel,
      VehicleBodyWork,
      ProductVariation,
      Complement,
      AttributeValue,
      SkuVariation,
    } = productParam.app.models;

    const determinateCategory = async (
      brand,
      category1,
      category2,
      category3
    ) => {
      // busco la marca
      let brandInstance;
      try {
        brandInstance = await Brand.findOne({
          where: {
            code: brand,
          },
        });
      } catch (error) {
        throw error;
      }

      // valido
      if (!brandInstance) {
        throw new Error(`La marca ${brand}, no existe.`);
      }

      // busco la categoria 1
      let categoryInstance1;
      try {
        categoryInstance1 = await ProductCategory.findOne({
          where: {
            name: category1,
            brandId: brandInstance.id,
            level: 1,
          },
        });
      } catch (error) {
        throw error;
      }

      // valido
      if (!categoryInstance1) {
        throw new Error(
          `La categoria ${category1} para la marca ${brand} y el nivel 1, no existe`
        );
      }
      console.log(
        `filtros name: ${category1}, brandId: ${brandInstance.id}, level: 1`
      );
      // busco la categoria 2
      let categoryInstance2;
      try {
        categoryInstance2 = await ProductCategory.findOne({
          where: {
            name: category2,
            brandId: brandInstance.id,
            level: 2,
            parentId: categoryInstance1.id,
          },
        });
      } catch (error) {
        throw error;
      }

      // valido
      if (!categoryInstance2) {
        throw new Error(
          `La categoria ${category2} para la marca ${brand}, el nivel 2 y la categoria padre ${categoryInstance1.name}, no existe`
        );
      }
      console.log(
        `filtros name: ${category2}, brandId: ${brandInstance.id}, level: 2, parentId: ${categoryInstance1.id}`
      );
      // busco la categoria 3
      let categoryInstance3;
      try {
        categoryInstance3 = await ProductCategory.findOne({
          where: {
            name: category3,
            brandId: brandInstance.id,
            level: 3,
            parentId: categoryInstance2.id,
          },
        });
      } catch (error) {
        throw error;
      }

      // valido
      if (!categoryInstance3) {
        throw new Error(
          `La categoria ${category3} para la marca ${brand}, el nivel 3 y la categoria padre ${categoryInstance2.name}, no existe`
        );
      }
      console.log(
        `filtros name: ${category3}, brandId: ${brandInstance.id}, level: 3, parentId: ${categoryInstance2.id}`
      );
      console.log("--------------------------");

      return categoryInstance3;
    };

    // Resuelvo las promesas
    const results = await Promise.all(
      productsFromAutogermana.map(
        throat(1, async (product) => {
          // valido
          if (!product.Marca) {
            return new Error("La marca es nula");
          }

          // busco la marca
          let brandInstance;
          try {
            brandInstance = await Brand.findOne({
              where: {
                name: product.Marca.trim(),
              },
            });
          } catch (error) {
            throw error;
          }

          // valido la marca
          if (!brandInstance) {
            return new Error(`La marca ${product.Marca}, no existe`);
          }

          // Busca el Categoria
          let categoryInstance;
          try {
            categoryInstance = await determinateCategory(
              product.Marca,
              product.Grupo,
              product.Categoria,
              product.Subcategoria
            );
          } catch (error) {
            return error;
          }

          // valido
          if (!categoryInstance) {
            return new Error(
              `La categoria ${product.Subcategoria}, para la marca ${product.Marca} y el nivel 3, no existe.`
            );
          }

          // Busca el el tipo de vehiculo
          let vehicleTypeInstance;
          try {
            vehicleTypeInstance = await VehicleType.findOne({
              where: {
                name: product.Clase,
              },
            });
          } catch (error) {
            return error;
          }

          // valido
          if (!vehicleTypeInstance) {
            try {
              vehicleTypeInstance = await VehicleType.create({
                name: product.Clase,
              });
            } catch (error) {
              return error;
            }
          }

          // busco la serie
          let vehicleSerieInstance;
          try {
            vehicleSerieInstance = await VehicleSerie.findOne({
              where: {
                name: product.Serie,
                brandId: brandInstance.id,
              },
            });
          } catch (error) {
            return error;
          }

          // valido
          if (!vehicleSerieInstance) {
            return new Error(
              `La serie ${product.Serie} y marca ${product.Marca} , no existe.`
            );
          }

          // busco el modelo
          let vehicleModelInstance;
          try {
            vehicleModelInstance = await VehicleModel.findOne({
              where: {
                name: product.Modelo,
                vehicleSerieId: vehicleSerieInstance.id,
              },
            });
          } catch (error) {
            throw error;
          }

          // valido
          if (!vehicleModelInstance) {
            return new Error(
              `El modelo ${product.Modelo} para la serie ${vehicleSerieInstance.name} que asu vez pertenece a la marca ${brandInstance.name}, no existe.`
            );
          }

          // busco la carroceria
          let vehicleBodyWorkInstance;
          try {
            vehicleBodyWorkInstance = await VehicleBodyWork.findOne({
              where: {
                name: product.Carroceria,
              },
            });
          } catch (error) {
            return error;
          }

          // valido
          if (!vehicleBodyWorkInstance) {
            return new Error(`La carroceria ${product.Carroceria}, no existe.`);
          }

          // defino el objeto
          const storeObject = {
            name: product.Almacen,
          };

          // encuentro o creo la tienda
          const { Store } = productParam.app.models;
          try {
            await Store.findOrCreate(
              {
                where: storeObject,
              },
              storeObject
            );
          } catch (error) {
            return error;
          }

          // obtengo los codigos para consultar los estados
          const parameterName = "LIFESTYLE";
          let codesOrderStaus;
          try {
            codesOrderStaus = await getParameterValue(parameterName);
          } catch (error) {
            return error;
          }

          let categoryLifeSTyle = false;
          if (codesOrderStaus === product.Grupo) {
            categoryLifeSTyle = true;
          }

          // BUSCO PARA VER SI ES HIJO - variaciones con colores, tallas y hijos
          let productsVariationColorAutogermana = [];
          /* VARIATION */
          if (categoryLifeSTyle) {
            try {
              productsVariationColorAutogermana = await autogermanaIntegration.getVariationBySKU(
                product.ItemNo_
              );
            } catch (error) {
              throw error;
            }
          }

          // obtengo el valor de la mercancia
          let total = 0;
          if (productsVariationColorAutogermana.length > 0) {
            total = productsVariationColorAutogermana
              .map((item) => item.DisponibleParte)
              .reduce((pre, cur) => pre + cur, 0);
          }

          let sumTotal = 0;
          if (productsVariationColorAutogermana.length > 0) {
            /* VARIATION */
            if (
              total === productsVariationColorAutogermana[0].DisponibleTotal
            ) {
              sumTotal = total;
            }
            sumTotal = total;
          } else {
            sumTotal = product.Disponible;
          }

          // defino el objeto
          const productObj = {
            name: product.Nombre,
            stock: product.Disponible,
            intent: 0,
            price: product.PrecioUnitarioIva,
            description: product.Descripcion,
            sku: product.ItemNo_,
            slug: slug(`${product.Nombre.toLowerCase()}-${product.ItemNo_}`),
            warrantyYear: product.Garantia,
            material: product.Material,
            weight: product.Peso,
            yearStart: parseInt(product.AñoInicio, 0),
            color: product.color,
            check: product.RequiereVerificacion === "SI",
            accessories: product.RequiereComplementos === "SI",
            yearEnd: parseInt(product.Añofin, 0),
            high: product.Alto,
            width: product.Ancho,
            weightVolume: product.PesoVolumen,
            size: product.Talla,
            long: product.Largo,
            vehicleTypeId: vehicleTypeInstance ? vehicleTypeInstance.id : null,
            productCategoryId: categoryInstance ? categoryInstance.id : null,
            priceWithTax: product.PrecioUnitarioIva,
            priceWithoutTax: product.PrecioUnitario,
            instalation: product.RequiereInstalacion === "SI",
            brandId: brandInstance.id,
            isFather: categoryLifeSTyle
              ? productsVariationColorAutogermana.length > 0
              : true,
            totalStock: sumTotal,
          };

          // busco o creo el producto
          let productResult;
          try {
            productResult = await productParam.findOrCreate(
              {
                where: {
                  sku: product.ItemNo_,
                },
              },
              productObj
            );
          } catch (error) {
            return error;
          }

          let productInstance = productResult[0];

          // si se encontro el producto, entonces lo actualizo
          if (!productResult[1]) {
            productObj.intent = productInstance.intent;
            productObj.price = productInstance.discount
              ? productInstance.price
              : product.PrecioUnitarioIva;
            try {
              await productInstance.updateAttributes(productObj);
            } catch (error) {
              return error;
            }
          }

          // defino el objeto
          const productVariationObject = {
            productId: productInstance.id,
            vehicleSerieId: vehicleSerieInstance.id,
            vehicleModelId: vehicleModelInstance.id,
            vehicleBodyWorkId: vehicleBodyWorkInstance.id,
          };

          try {
            await ProductVariation.findOrCreate(
              {
                where: productVariationObject,
              },
              productVariationObject
            );
          } catch (error) {
            return error;
          }

          // Recorrer areglos de los componentes para hacer lo siguiente
          // Busco el complemento con el producto
          if (product.Complemento !== null) {
            product.Complemento.map(
              throat(1, async (pro) => {
                let complementInstance = null;
                try {
                  complementInstance = await Complement.findOne({
                    where: {
                      productId: productInstance.id,
                      sku: pro.Complemento,
                    },
                  });
                } catch (error) {
                  throw error;
                }

                // si no esta lo creo
                if (!complementInstance) {
                  try {
                    await Complement.create({
                      productId: productInstance.id,
                      name: productInstance.name,
                      sku: pro.Complemento,
                      amount: pro.Cantidad,
                      description: pro.Descripcion,
                      price: parseInt(pro.ValorComplemento),
                      priceWithTax: parseInt(pro.ValorComplementoIVA),
                      active: true,
                    });
                  } catch (error) {
                    return error;
                  }
                }
              })
            );
          }

          // Busco el atributos con el producto
          if (product.Atributo !== null) {
            product.Atributo.map(
              throat(1, async (attribute) => {
                let attributeInstance = null;
                try {
                  attributeInstance = await AttributeValue.findOne({
                    where: {
                      productId: productInstance.id,
                      sku: attribute.Valor,
                    },
                  });
                } catch (error) {
                  throw error;
                }

                // si no esta lo creo
                if (!attributeInstance) {
                  console.log(attributeInstance);
                  try {
                    await AttributeValue.create({
                      productId: productInstance.id,
                      sku: attribute.Valor,
                      value: attribute.Atributo,
                    });
                  } catch (error) {
                    return error;
                  }
                }
              })
            );
          }

          /* RECORRO Y CREO LOS SKU COLOR y TALLA */
          /* VARIATION */
          if (productsVariationColorAutogermana.length > 0) {
            productsVariationColorAutogermana.map(
              throat(1, async (children) => {
                // busco o creo el producto
                let productChildrenInstance;
                try {
                  productChildrenInstance = await productParam.findOne({
                    where: {
                      sku: children.ReferenciaVariacion,
                    },
                  });
                } catch (error) {
                  return error;
                }

                let productNewInatance = {};
                // valido
                if (!productChildrenInstance) {
                  // defino el objeto
                  const productObj = {
                    name: product.Nombre,
                    stock: product.Disponible,
                    price: product.PrecioUnitarioIva,
                    description: product.Descripcion,
                    sku: children.ReferenciaVariacion,
                    slug: slug(
                      `${children.NombrePadre.toLowerCase()}-${
                      children.ReferenciaVariacion
                      }`
                    ),
                    warrantyYear: product.Garantia,
                    weight: product.Peso,
                    yearStart: parseInt(product.AñoInicio, 0),
                    color: children.color,
                    check: product.RequiereVerificacion === "SI",
                    accessories: product.RequiereComplementos === "SI",
                    yearEnd: parseInt(product.Añofin, 0),
                    high: product.Alto,
                    width: product.Ancho,
                    weightVolume: product.PesoVolumen,
                    size: children.Talla,
                    long: product.Largo,
                    vehicleTypeId: vehicleTypeInstance
                      ? vehicleTypeInstance.id
                      : null,
                    productCategoryId: categoryInstance
                      ? categoryInstance.id
                      : null,
                    priceWithTax: product.PrecioUnitarioIva,
                    priceWithoutTax: product.PrecioUnitario,
                    instalation: product.RequiereInstalacion === "SI",
                    brandId: brandInstance.id,
                    isFather: false,
                  };

                  // busco o creo el producto
                  let productChildrenResult;
                  try {
                    productChildrenResult = await productParam.findOrCreate(
                      {
                        where: {
                          sku: children.ReferenciaVariacion,
                        },
                      },
                      productObj
                    );
                  } catch (error) {
                    return error;
                  }

                  // defino el objeto
                  const productVariationObject = {
                    productId: productChildrenResult[0].id,
                    vehicleSerieId: vehicleSerieInstance.id,
                    vehicleModelId: vehicleModelInstance.id,
                    vehicleBodyWorkId: vehicleBodyWorkInstance.id,
                  };

                  let ProductVariationIntance;
                  try {
                    ProductVariationIntance = await ProductVariation.findOrCreate(
                      {
                        where: productVariationObject,
                      },
                      productVariationObject
                    );
                  } catch (error) {
                    return error;
                  }

                  productNewInatance =
                    productChildrenResult[0] || ProductVariationIntance[0];
                }

                // defino el objeto
                const productObj = {
                  productId: productInstance.id,
                  color: children.Color,
                  size: children.Talla,
                  skuChildren: children.ReferenciaVariacion,
                  productChildrenId: productChildrenInstance
                    ? productChildrenInstance.id
                    : productNewInatance.id,
                };

                // busco o creo el producto
                try {
                  await SkuVariation.findOrCreate(
                    {
                      where: productObj,
                    },
                    productObj
                  );
                } catch (error) {
                  return error;
                }
              })
            );
          }

          return productInstance;
        })
      )
    );

    const instances = results
      .filter((item) => !(item instanceof Error))
      .map((item) => item.sku);
    const erros = results
      .filter((item) => item instanceof Error)
      .map((item) => item.message);

    return {
      processed: instances.length,
      erros,
    };
  };
  productParam.remoteMethod("handleProductsAutogermana", {
    accepts: {
      arg: "sku",
      type: "string",
      require: true,
      description: "0",
    },
    http: {
      verb: "post",
      path: "/handle-products-autogermana/:sku",
    },
    returns: {
      arg: "data",
      type: "Object",
      root: true,
    },
  });

  // Ver la lista de todos los productos
  productParam.getProducts = async (req, body) => {
    req.setTimeout(0);
    let products = null;
    try {
      products = await autogermanaIntegration.getProducts(body);
    } catch (error) {
      throw error;
    }

    return products;
  };
  productParam.remoteMethod("getProducts", {
    accepts: [
      {
        arg: "req",
        type: "object",
        http: {
          source: "req",
        },
      },
      {
        arg: "body",
        type: "Object",
        require: true,
        description: "{ id: 0, productId: 0 }",
      },
    ],
    http: {
      verb: "post",
      path: "/autogermana/products",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });

  // Ver un producto en el servicio y en la base para consultas del front
  productParam.getProduct = async function (req, sku) {
    req.setTimeout(0);
    const { Store, StoreProduct } = Product.app.models;

    let product = null;
    try {
      product = await autogermanaIntegration.getProduct(sku);
    } catch (error) {
      throw error;
    }

    let productInstance = null;
    try {
      productInstance = await productParam.findOne({
        where: {
          sku,
        },
      });
    } catch (error) {
      throw error;
    }

    product.map(async (item) => {
      let storeInstance = null;
      try {
        storeInstance = await Store.findOne({
          where: {
            name: item.Almacen,
          },
        });
      } catch (error) {
        throw error;
      }

      let productInStoreInstance = null;
      try {
        productInStoreInstance = await StoreProduct.findOne({
          where: {
            productId: productInstance.id,
            storeId: storeInstance.id,
          },
        });
      } catch (error) {
        throw error;
      }

      try {
        if (productInStoreInstance) {
          await StoreProduct.updateAll(
            {
              productId: productInstance.id,
              storeId: storeInstance.id,
            },
            {
              price: item.PrecioUnitarioIva,
              stock: item.Disponible,
            },
            () => { }
          );
        } else {
          await StoreProduct.create(
            {
              productId: productInstance.id,
              storeId: storeInstance.id,
              price: product.PrecioUnitarioIva,
              priceWithTax: product.PrecioUnitarioIva,
              priceWithoutTax: product.PrecioUnitario,
              stock: item.Disponible,
            },
            () => { }
          );
        }
      } catch (error) {
        throw error;
      }
    });

    const result = {};
    result.product = productInstance;
    result.productService = product;

    return result;
  };
  productParam.remoteMethod("getProduct", {
    accepts: [
      {
        arg: "req",
        type: "object",
        http: {
          source: "req",
        },
      },
      {
        arg: "sku",
        type: "string",
        require: true,
        description: "sku del producto",
      },
    ],
    http: {
      verb: "post",
      path: "/autogermana/product",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });

  // Crea los productos de la lista
  productParam.createdProducts = async (req, body) => {
    req.setTimeout(0);
    const { ProductCategory, VehicleType, Brand } = productParam.app.models;

    let products = [];
    try {
      products = await autogermanaIntegration.getProducts(body);
    } catch (error) {
      throw error;
    }

    let names = [];
    const arrayProductNoRep = products
      .map((product, index) => {
        if (!product.ItemNo_) {
          return null;
        }

        if (index < 1) {
          names.push(product.ItemNo_);
          return product;
        } else if (!names.includes(product.ItemNo_)) {
          names.push(product.ItemNo_);
          return product;
        }
        return null;
      })
      .filter((item) => item !== null);

    // Resulevo las promesas
    const arrayProducts = await Promise.all(
      arrayProductNoRep.map(
        throat(1, async (product) => {
          let brandInstance = null;
          try {
            brandInstance = await Brand.findOne({
              where: {
                name: product.Marca,
              },
            });
          } catch (error) {
            throw error;
          }
          console.log("Brand", brandInstance);

          // Busca el producto
          let storeInstance = null;
          try {
            storeInstance = await productParam.findOne({
              where: {
                sku: product.ItemNo_,
                name: product.Nombre,
                brandId: brandInstance.id,
              },
            });
          } catch (error) {
            return error;
          }

          // Busca el Categoria
          let categoryInstance = null;
          try {
            categoryInstance = await ProductCategory.findOne({
              where: {
                name: product.Subcategoria,
                level: 3,
              },
            });
          } catch (error) {
            return error;
          }

          // Busca el el tipo
          let vehicleTypeInstance = null;
          try {
            vehicleTypeInstance = await VehicleType.findOne({
              where: {
                name: product.Clase,
              },
            });
          } catch (error) {
            return error;
          }

          if (!vehicleTypeInstance) {
            try {
              vehicleTypeInstance = await VehicleType.create({
                name: product.Clase,
              });
            } catch (error) {
              return error;
            }
          }

          // Crea el producto
          let productInstance;
          if (storeInstance === null) {
            try {
              productInstance = await productParam.create({
                name: product.Nombre,
                stock: product.Disponible,
                intent: 0,
                price: product.PrecioUnitarioIva,
                description: product.Descripcion,
                sku: product.ItemNo_,
                warrantyYear: product.Garantia,
                weight: product.Peso,
                series: product.Serie,
                modelName: product.Modelo,
                yearStart: product.AñoInicio,
                color: product.color,
                bodywork: product.Carroceria,
                check: product.RequiereVerificacion === "SI",
                accessories: product.RequiereComplementos === "SI",
                yearEnd: product.Añofin,
                vehicleClass: product.Clase,
                high: product.Alto,
                width: product.Ancho,
                weightVolume: product.PesoVolumen,
                size: product.Talla,
                long: product.Largo,
                vehicleTypeId: vehicleTypeInstance ? vehicleTypeInstance.id : 0,
                productCategoryId: categoryInstance ? categoryInstance.id : 0,
                priceWithTax: product.PrecioUnitarioIva,
                priceWithoutTax: product.PrecioUnitario,
                make: product.Marca,
                instalation: product.RequiereInstalacion === "SI",
                brandId: brandInstance.id,
              });
            } catch (error) {
              return error;
            }
          } else {
            try {
              productInstance = await productParam.updateAll(
                {
                  sku: product.ItemNo_,
                },
                {
                  name: product.Nombre,
                  description: product.Descripcion,
                  brandId: brandInstance.id,
                  price: product.PrecioUnitarioIva,
                  priceWithTax: product.PrecioUnitarioIva,
                  priceWithoutTax: product.PrecioUnitario,
                  color: product.color,
                  stock: product.Disponible,
                  intent: productInstance.intent,
                  productCategoryId: categoryInstance ? categoryInstance.id : 0,
                }
              );
            } catch (error) {
              return error;
            }
          }

          return productInstance || product;
        })
      )
    );
    return arrayProducts;
  };
  productParam.remoteMethod("createdProducts", {
    accepts: [
      {
        arg: "req",
        type: "object",
        http: {
          source: "req",
        },
      },
      {
        arg: "body",
        type: "Object",
        require: true,
        description: "{ id: 0, productId: 0 }",
      },
    ],
    http: {
      verb: "post",
      path: "/autogermana/created-products",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });

  // Buscar producto con palabra
  productParam.searchProduct = async function (body, cb) {
    let products = null;
    try {
      if (body.q) {
        if (body.productCategoryId) {
          products = await productParam.find({
            where: {
              name: {
                regexp: `^${body.q}/i`,
              },
              productCategoryId: body.productCategoryId,
            },
            limit: body.limit ? body.limit : 50,
          });
        } else {
          products = await productParam.find({
            where: {
              name: {
                regexp: `^${body.q}/i`,
              },
            },
            limit: body.limit ? body.limit : 50,
          });
        }
      } else {
        products = await productParam.find({
          where: {
            productCategoryId: body.productCategoryId,
          },
          limit: body.limit ? body.limit : 50,
        });
      }
    } catch (error) {
      return cb(error);
    }

    return products;
  };
  productParam.remoteMethod("searchProduct", {
    accepts: {
      arg: "body",
      type: "Object",
      require: true,
      description: '{ q: "Cas", productCategoryId: 1, limit: 10 }',
    },
    http: {
      verb: "post",
      path: "/searchProduct",
    },
    returns: {
      arg: "data",
      root: true,
      type: "Object",
    },
  });

  // Buscar producto con motivadores del usuario
  productParam.searchMotivatorProduct = async (body) => {
    const { MyUser } = productParam.app.models;

    let user;
    try {
      user = await MyUser.findOne({
        where: {
          id: body.userId,
        },
      });
    } catch (error) {
      throw error;
    }

    let motivators = null;
    try {
      motivators = await user.motivators.find();
    } catch (error) {
      throw error;
    }
    const arrayProducts = motivators.map(async (category) => {
      let product = null;
      try {
        product = await productParam.find({
          where: {
            productCategoryId: category.productCategoryId,
          },
        });
      } catch (error) {
        throw error;
      }

      return product;
    });
    const resultProducts = await Promise.all(arrayProducts);

    let products = [];
    resultProducts.map(async (product) => {
      product.map((item) => {
        products.push(item);
      });
    });

    return products;
  };
  productParam.remoteMethod("searchMotivatorProduct", {
    accepts: {
      arg: "body",
      type: "Object",
      require: true,
      description: "{ userId: 1, limit: 3}",
    },
    http: {
      verb: "post",
      path: "/searchMotivatorProduct",
    },
    returns: {
      arg: "data",
      root: true,
      type: "Object",
    },
  });

  // Servicio para la devolucion de los productos
  productParam.returnProductMail = async (body) => {
    try {
      await integrationMail.returnProductMail(body);
      body.message = "Mensaje enviado";
    } catch (error) {
      return error;
    }
    return body;
  };
  productParam.remoteMethod("returnProductMail", {
    accepts: {
      arg: "body",
      type: "Object",
      require: true,
      description: "{ email: 1, order: 3, lastName: 2, reason: 2}",
    },
    http: {
      verb: "post",
      path: "/returnProductMail",
    },
    returns: {
      arg: "data",
      root: true,
      type: "Object",
    },
  });

  // Validar compactibilidad del vehiculo con la parte
  productParam.compatibility = async (body) => {
    const { Vehicle } = Product.app.models;

    let product = null;
    try {
      product = await productParam.findOne({
        where: {
          sku: body.sku,
        },
      });
    } catch (error) {
      throw error;
    }

    let vehicle = null;
    try {
      vehicle = await Vehicle.findOne({
        where: {
          chassis: body.chassis,
        },
      });
    } catch (error) {
      throw error;
    }

    let vehicleBrand = null;
    try {
      vehicleBrand = await vehicle.vehicleBrand.get();
    } catch (error) {
      throw error;
    }

    let vehicleSerie = null;
    try {
      vehicleSerie = await vehicle.vehicleSerie.get();
    } catch (error) {
      throw error;
    }

    let vehicleModel = null;
    try {
      vehicleModel = await vehicle.vehicleModel.get();
    } catch (error) {
      throw error;
    }

    let productVariations = null;
    try {
      productVariations = await product.productVariations.find();
    } catch (error) {
      throw error;
    }

    // obtengo las series de las variaciones
    let serieVariation = null;
    for (const variation of productVariations) {
      if (variation.vehicleSerieId === vehicle.vehicleSerieId) {
        serieVariation = variation;
        break;
      }
    }

    // obtengo los modelos de las variaciones
    let modelVariation = null;
    for (const variation of productVariations) {
      if (variation.vehicleModelId === vehicle.vehicleModelId) {
        modelVariation = variation;
        break;
      }
    }

    vehicleSerie = vehicleSerie || {};
    let compatibility = false;
    if (
      modelVariation !== null &&
      modelVariation.vehicleModelId === vehicle.vehicleModelId &&
      serieVariation !== null &&
      serieVariation.vehicleSerieId === vehicle.vehicleSerieId &&
      vehicle.model <= product.yearStart &&
      product.yearEnd >= vehicle.model
    ) {
      compatibility = true;
    } else {
      compatibility = false;
    }

    const result = {};
    result.product = product;
    result.vehicle = vehicle;
    result.compatibility = compatibility;
    result.vehicleSerie = vehicleSerie;
    result.vehicleModel = vehicleModel;
    result.vehicleBrand = vehicleBrand;

    return result;
  };
  productParam.remoteMethod("compatibility", {
    accepts: {
      arg: "body",
      type: "Object",
      require: true,
      description: "{sku: 34402240174, chassis: WBA8A1104GK357102 }",
    },
    http: {
      verb: "post",
      path: "/autogermana/compatibility",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });

  // Validar compactibilidad del vehiculo con la parte
  productParam.vehicleAvailability = async (req) => {
    const { body } = req;

    let productInstance = null;
    try {
      productInstance = await productParam.findOne({
        where: {
          sku: body.sku,
          brandId: body.brandId,
        },
        include: "imageProducts",
      });
    } catch (error) {
      throw error;
    }

    // valido
    if (!productInstance) {
      return new Error(`El producto con el sku ${body.sku}, no existe.`);
    }

    let availabilityAutogermana;
    try {
      availabilityAutogermana = await autogermanaIntegration.getDetailAvailability(
        body.sku
      );
    } catch (error) {
      throw error;
    }

    if (
      availabilityAutogermana.length != 0 &&
      !availabilityAutogermana[0].Disponible >= 1
    ) {
      try {
        productInstance.updateAttributes({
          stock: 0,
        });
      } catch (error) {
        console.log(error);
        throw error;
      }
      /* throw new Error('No hay disponibilidad del producto') */
    }

    // actualizo la producto
    if (availabilityAutogermana.length > 0 && productInstance) {
      try {
        await productInstance.updateAttributes({
          stock: availabilityAutogermana[0].Disponible,
        });
      } catch (error) {
        throw error;
      }
    }

    return productInstance;
  };
  productParam.remoteMethod("vehicleAvailability", {
    description:
      "Validad disponibilidad y actuaizar a la isma vez {sku: 34402240174, id: 1 }",
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/vehicle-availability",
    },
    returns: {
      type: "object",
      description: "objeto la validacion de la disponibilidad",
      root: true,
    },
  });

  // Validar compactibilidad de los items con la parte
  productParam.itemsAvailability = async (req) => {
    const { Order, OrderDetail } = productParam.app.models;

    let orderInstance = null;
    try {
      orderInstance = await Order.findOne({
        where: {
          id: req.query.orderId,
        },
      });
    } catch (error) {
      throw error;
    }

    let itemsInstance = null;
    try {
      itemsInstance = await orderInstance.orderDetails.find();
    } catch (error) {
      throw error;
    }

    const arrayItems = [];
    await Promise.all(
      itemsInstance.map(async (item) => {
        let productInstance = null;
        try {
          productInstance = await productParam.findOne({
            where: {
              sku: item.sku,
              brandId: item.brandId,
            },
          });
        } catch (error) {
          throw error;
        }

        // valido
        if (!productInstance) {
          return new Error(`El producto con el sku ${item.sku}, no existe.`);
        }

        let availabilityAutogermana;
        try {
          availabilityAutogermana = await autogermanaIntegration.getDetailAvailability(
            item.sku
          );
        } catch (error) {
          throw error;
        }

        let objItem;

        if (item.quantity > availabilityAutogermana[0].Disponible) {
          objItem = {
            id: item.id,
            sku: item.sku,
            name: item.name,
            image: item.image,
            stock: availabilityAutogermana[0].Disponible,
          };

          try {
            await OrderDetail.destroyById(item.id);
            arrayItems.push(objItem);
          } catch (error) {
            throw error;
          }
        } else {
          // actualizo el producto
          try {
            await productInstance.updateAttributes({
              stock: availabilityAutogermana[0].Disponible,
              intent: productInstance.intent + item.quantity,
            });
          } catch (error) {
            throw error;
          }
          // Intencion
        }
      })
    );

    const result = {};
    result.itemsDeleted = arrayItems.length;
    result.items = arrayItems;
    result.order = orderInstance;
    result.itemsOrder = itemsInstance;
    return result;
  };
  productParam.remoteMethod("itemsAvailability", {
    description:
      "Validad disponibilidad y actuaizar a la isma vez { sku: orderId }",
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "get",
      path: "/items-availability",
    },
    returns: {
      type: "object",
      description: "objeto la validacion de la disponibilidad",
      root: true,
    },
  });

  // Variacion de color
  productParam.colorVariations = async (req) => {
    const { body } = req;

    const { SkuVariation } = productParam.app.models;

    let productInstance = null;
    try {
      productInstance = await productParam.findOne({
        where: {
          sku: body.sku,
          brandId: body.brandId,
        },
        include: "imageProducts",
      });
    } catch (error) {
      throw error;
    }

    // valido
    if (!productInstance) {
      return new Error(`El producto con el sku ${body.sku}, no existe.`);
    }

    let productVariations = null;
    try {
      productVariations = await productInstance.skuVariations.find();
    } catch (error) {
      throw error;
    }

    let colorDetails = [];
    productVariations.map(async (item) => {
      if (!colorDetails.includes(item.color)) {
        colorDetails.push(item.color);
      }
    });
    const arrayProducts = colorDetails.map(async (item) => {
      let sizes = null;

      try {
        sizes = await SkuVariation.find({
          where: { color: item, productId: productInstance.id },
        });
      } catch (error) {
        throw error;
      }

      const sizesArrayRe = await Promise.all(sizes);
      const sizesArray = sizesArrayRe.map(async (size) => {
        let productSku = null;
        try {
          productSku = await size.productChildren.get();
        } catch (error) {
          throw error;
        }

        let productSkuImage = null;
        try {
          productSkuImage = await productSku.imageProducts.find();
        } catch (error) {
          throw error;
        }

        const objColorIem = size;
        objColorIem.skuFather = productInstance.sku;
        objColorIem.sku = size.skuChildren;
        objColorIem.hex = productSku.hex;
        objColorIem.stock = productSku.stock;
        objColorIem.images = productSkuImage;
        objColorIem.price = productSku.price;
        objColorIem.discountPercentage = productSku.discountPercentage;
        objColorIem.initDateDiscount = productSku.initDateDiscount;
        objColorIem.endDateDiscount = productSku.endDateDiscount;
        return objColorIem;
      });

      let productSkuImage = null;
      try {
        productSkuImage = await productInstance.imageProducts.find();
      } catch (error) {
        throw error;
      }
      let sizeVariation = await Promise.all(sizesArray);
      const objColorItem = {
        color: item.includes("/") ? "MULTICOLOR" : item,
        hex: sizeVariation[0].hex ? sizeVariation[0].hex : productInstance.hex,
        images: productSkuImage,
        zisesVariations: sizeVariation,
      };

      return objColorItem;
    });

    // valido
    if (!productVariations) {
      return new Error(
        `El producto con el sku ${body.sku}, no tiene variaciones.`
      );
    }

    const result = productInstance;
    result.colorVariations = await Promise.all(arrayProducts);
    return result;
  };

  productParam.remoteMethod("colorVariations", {
    description: "Colores y variaciones {sku: 34402240174, id: 1 }",
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/color-variations",
    },
    returns: {
      type: "object",
      description: "objeto la validacion de la disponibilidad",
      root: true,
    },
  });

  productParam.modelCompatibility = async (sku) => {
    let productsFromAutogermana = [];
    try {
      productsFromAutogermana = await autogermanaIntegration.getModelCompatibility(
        sku
      );
    } catch (error) {
      throw error;
    }

    // valido
    if (productsFromAutogermana.length === 0) {
      throw new Error(`El producto con el sku ${sku}, no existe.`);
    }

    const modelsInstance = productsFromAutogermana.map((model) => {
      let objModel = {
        name: model.Nombre,
        sku: model.Referencia,
        brand: model.Marca,
        serie: model.Serie,
        model: model.Modelo,
        startYear: model.AInicio,
        endYear: model.AFin,
      };
      return objModel;
    });

    return modelsInstance || productsFromAutogermana;
  };
  productParam.remoteMethod("modelCompatibility", {
    accepts: {
      arg: "sku",
      type: "string",
      require: true,
      description: "0",
    },
    http: {
      verb: "post",
      path: "/modelCompatibility/:sku",
    },
    returns: {
      arg: "data",
      type: "Object",
      root: true,
    },
  });

  // Validar compactibilidad de los items con la parte del resumen de la orden
  productParam.productsAvailability = async (req) => {
    const { Order, OrderDetail, OrderStatus } = productParam.app.models;

    // Orden
    let orderInstance = null;
    try {
      orderInstance = await Order.findOne({
        where: {
          id: req.query.orderId,
        },
      });
    } catch (error) {
      throw error;
    }

    // Order details, productos
    let itemsInstance = null;
    try {
      itemsInstance = await orderInstance.orderDetails.find();
    } catch (error) {
      throw error;
    }

    // Obtego el estado
    let orderStatusInstance = null;
    try {
      orderStatusInstance = await OrderStatus.findOne({
        where: {
          code: "CREADA",
        },
      });
    } catch (error) {
      throw error;
    }

    let orderInstances = null;
    try {
      orderInstances = await Order.find({
        where: {
          orderStatusId: orderStatusInstance.id,
          id: { neq: orderInstance.id },
        },
      });
    } catch (error) {
      throw error;
    }

    // AQUI
    const arrayItems = [];
    orderInstances.map(async (order) => {
      let productInstances = null;
      try {
        productInstances = await OrderDetail.find({
          where: {
            orderId: order.id,
          },
        });
      } catch (error) {
        throw error;
      }

      productInstances.map(async (product) => {
        console.log("product: ", product.productId);
        console.log("order: ", product.orderId);
        itemsInstance.map(async (detail) => {
          console.log("ORDER DETAIL: ", detail.productId);
          if (product.productId === detail.productId) {
            console.log("Producto igual");
          }
        });
        console.log("----------------");
      });
      console.log("ORDER", order.id);
      console.log("*******************");
    });
    console.log(arrayItems);
    // FIN AQUI

    const result = {};
    // result.itemsDeleted = arrayItems.length
    // result.items = arrayItems
    result.order = orderInstance;
    result.itemsOrder = itemsInstance;
    return result;
  };
  productParam.remoteMethod("productsAvailability", {
    description:
      "Validad disponibilidad y actuaizar a la isma vez { sku: orderId }",
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "get",
      path: "/products-availability",
    },
    returns: {
      type: "object",
      description: "objeto la validacion de la disponibilidad",
      root: true,
    },
  });

  productParam.productActive = async (req) => {
    // Order details, productos
    let productsInstance = null;
    try {
      productsInstance = await productParam.find({
        where: { totalStock: { gt: 0 } },
        include: "imageProducts",
      });
    } catch (error) {
      throw error;
    }

    const products = await Promise.all(productsInstance);
    products.map(async (product) => {
      let imageProducts = null;
      try {
        imageProducts = await product.imageProducts.find();
      } catch (error) {
        throw error;
      }

      if (imageProducts.length && product.isFather) {
        await product.updateAttributes({
          active: true,
        });
      } else if (imageProducts.length >= 1 && product.stock > 0) {
        await product.updateAttributes({
          active: true,
        });
      } else {
        await product.updateAttributes({
          active: false,
        });
      }
    });

    return productsInstance;
  };
  productParam.remoteMethod("productActive", {
    description:
      "activar y desactivar productos con inventario menos a 0 y sin imagenes",
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "get",
      path: "/product-active",
    },
    returns: {
      type: "object",
      description: "objeto la validacion de la disponibilidad",
      root: true,
    },
  });

  productParam.discount = async (req) => {
    let products = req.body.items;
    let productReference = [];
    if (req.body.percentage > 100 || req.body.percentage < 0) {
      throw "Percentage is incorrect";
    }
    try {
      products.map(async (productRef) => {
        let product = await productParam.findOne({
          where: {
            sku: productRef.reference,
          },
        });
        await product.updateAttributes({
          discountPercentage: req.body.percentage,
          initDateDiscount: new Date(req.body.initDateDiscount),
          endDateDiscount: new Date(req.body.endDateDiscount),
        });
        /*         productReference.push(product) */
      });
    } catch (error) {
      throw error;
    }
    return "Exit 1";
  };

  productParam.remoteMethod("discount", {
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/discount",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });

  productParam.ProductsLoad = async (req) => {
    const {
      SkuVariation,
      ProductCategory,
      ImageProduct,
      ProductVariation,
      VehicleSerie,
      VehicleModel,
      VehicleBodyWork,
      AttributeValue,
    } = productParam.app.models;
    let payload = req.body;
    let response = {
      affectedItemsUpdate: [],
      affectedItemsCreate: [],
    };
    /*     let tree;
        try {
          tree = await generator.generate(`/images`)
        } catch (error) {
          throw error
        }
        return tree; */
    if (payload["lifestyle"] && payload["lifestyle"].length > 0) {
      await Promise.all(
        payload["lifestyle"].map(async (product, i) => {
          let productResponse = [];
          let variation;
          const categoryInstance1 = await ProductCategory.findOrCreate(
            {
              where: {
                name: product.category,
                brandId: product.brandId,
              },
            },
            {
              name: product.category,
              brandId: product.brandId,
              isMotivator: false,
              level: 2,
              parentId: 5328,
            }
          );

          let categoryInstance2;
          if (product.subCategory != 0) {
            categoryInstance2 = await ProductCategory.findOrCreate(
              {
                where: {
                  name: product.subCategory,
                  brandId: product.brandId,
                  parentId: categoryInstance1[0].id
                },
              },
              {
                name: product.subCategory,
                brandId: product.brandId,
                isMotivator: false,
                level: 3,
                parentId: categoryInstance1[0].id,
              }
            );
          }

          let productInstanceFather = await productParam.findOne({
            where: {
              sku: product.sku,
            },
          });

          try {
            let instaceVariation = await Promise.all(
              product["variations"].map(async (productVariation, i) => {
                let productInstance = await productParam.findOne({
                  where: {
                    sku: productVariation.skuchildren,
                  },
                });

                let isCategory =
                  product.subCategory == 0
                    ? categoryInstance1[0].id
                    : categoryInstance2[0].id;
                /*     console.log(productInstance); */
                if (productInstance && isCategory) {
                  let productVariationUdate = await productParam.updateAll(
                    { sku: productVariation.skuchildren },
                    {
                      ...productVariation,
                      price: productVariation.priceWithTax,
                      productCategoryId:
                        product.subCategory == 0
                          ? categoryInstance1[0].id
                          : categoryInstance2[0].id,
                      name: product.name,
                      /* priceWithTax: productVariation.priceWithTax, */
                      /* priceWithoutTax: productVariation.priceWithoutTax, */
                      sku: productVariation.skuchildren,
                      scale: product.scale,
                      warrantYear: product.warrantyear,
                      /* active: product.active, */
                      collection: product.collection,
                      brandId: product.brandId,
                      description: product.description,
                      material: product.material,
                      type: product.type,
                    }
                  );
                  if (productVariation.isFather) {
                    console.log(productInstance, "es padre");
                    productInstanceFather = productInstance;
                  }
                  response.affectedItemsUpdate.push({
                    sku: productVariation.skuchildren,
                    isFather: productVariation.isFather,
                  });
                } else if (isCategory) {
                  let productVariationCreate = await productParam.create({
                    /* price: productVariation.priceWithTax, */
                    /* stock: productVariation.stock, */
                    ...productVariation,
                    productCategoryId:
                      product.subCategory == 0
                        ? categoryInstance1[0].id
                        : categoryInstance2[0].id,
                    name: product.name,
                    /* priceWithTax: productVariation.priceWithTax, */
                    /* priceWithoutTax: productVariation.priceWithoutTax, */
                    sku: productVariation.skuchildren,
                    scale: product.scale,
                    warrantYear: product.warrantyear,
                    active: product.active,
                    brandId: product.brandId,
                    description: product.description,
                    material: product.material,
                    type: product.type,
                  });
                  response.affectedItemsCreate.push({
                    sku: productVariation.skuchildren,
                    isFather: productVariation.isFather,
                  });
                } else {
                  response.noCreateCategory.push({
                    sku: productVariation.skuchildren,
                    isFather: productVariation.isFather,
                    productCategoryId:
                      product.subCategory + " - " + product.category,
                  });
                }

                let test = await productParam.upsertWithWhere(
                  {
                    sku: productVariation.skuchildren,
                  },
                  {
                    price: productVariation.priceWithTax,
                    stock: productVariation.stock,
                    productCategoryId:
                      product.subCategory == 0
                        ? categoryInstance1[0].id
                        : categoryInstance2[0].id,
                    name: product.name,
                    priceWithTax: productVariation.priceWithTax,
                    priceWithoutTax: productVariation.priceWithoutTax,
                    sku: productVariation.skuchildren,
                    scale: product.scale,
                    warrantYear: product.warrantyear,
                    active: product.active,
                    gender: productVariation.gender,
                    collection: product.collection,
                    brandId: product.brandId,
                    description: product.description,
                    isFather: i > 0 ? false : true,
                    material: product.material,
                    type: product.type,
                    hex: productVariation.hex,
                  }
                );
                // Busco el atributos con el producto
                if (product.attributes) {
                  product.attributes.map(
                    throat(1, async (attribute) => {
                      let attributeInstance = null;
                      try {
                        attributeInstance = await AttributeValue.findOne({
                          where: {
                            productId: productInstance.id,
                            sku: attribute,
                          },
                        });
                      } catch (error) {
                        throw error;
                      }

                      // si no esta lo creo
                      if (!attributeInstance) {
                        try {
                          await AttributeValue.create({
                            productId: productInstance.id,
                            sku: productInstance.sku,
                            value: attribute,
                          });
                        } catch (error) {
                          return error;
                        }
                      }
                    })
                  );
                }

                let productVariationInstance = await productParam.findOne({
                  where: {
                    sku: productVariation.skuchildren,
                  },
                });
                let result = await SkuVariation.findOne({
                  where: {
                    skuChildren: productVariation.skuchildren,
                  },
                });

                if (result != null) {
                  let t = await SkuVariation.updateAll(
                    { skuChildren: productVariation.skuchildren },
                    {
                      color: productVariation.color,
                      skuChildren: productVariation.skuchildren,
                      productId: productInstanceFather.id,
                      size: productVariation.size,
                      productChildrenId: productVariationInstance.id,
                    }
                  );
                  console.log("actualizando ++++++++++++++++++", t, productInstanceFather.id, productVariation.skuchildren)
                } else {
                  console.log("creando ++++++++++++++++++")
                  let nt = await SkuVariation.create({
                    color: productVariation.color,
                    skuChildren: productVariation.skuchildren,
                    productId: productInstanceFather.id,
                    size: productVariation.size,
                    productChildrenId: productVariationInstance.id,
                  });
                }
                return {
                  sku: productInstance.sku,
                };
              })
            );
            productResponse = instaceVariation;
            return productResponse;
          } catch (err) {
            return err;
          }
        })
      );
    } else if (payload["accessories"] && payload["accessories"].length > 0) {
      await Promise.all(
        payload["accessories"].map(async (product) => {
          const categoryInstance1 = await ProductCategory.findOne({
            where: {
              name: product.category,
              brandId: product.brandId,
            },
          });

          let categoryInstance2;
          if (product.subCategory != 0) {
            categoryInstance2 = await ProductCategory.findOne({
              where: {
                name: product.subCategory,
                brandId: product.brandId
              },
            });
          }
          if (!categoryInstance1 || !categoryInstance2) {
            console.log(
              categoryInstance1,
              categoryInstance2,
              product.name,
              "Producto sin cargar"
            );
          } else {
            /* console.log(product, "Producto  cargar"); */
          }

          product.productCategoryId =
            product.subCategory == 0
              ? categoryInstance1.id
              : categoryInstance2.id;

          let isAccesory = await productParam.findOne({
            where: {
              sku: product.sku,
              brandId: product.brandId
            },
          });
          if (isAccesory && product.productCategoryId) {
            let accesory = await productParam.updateAll(
              {
                sku: product.sku,
                brandId: product.brandId
              },
              {
                price: product.priceWithTax,
                stock: product.stock,
                productCategoryId: product.productCategoryId,
                name: product.name,
                priceWithTax: product.priceWithTax,
                priceWithoutTax: product.priceWithoutTax,
                sku: product.sku,
                warrantYear: product.warrantyear,
                active: product.active,
                collection: product.collection,
                brandId: product.brandId,
                description: product.description,
                material: product.material,
                type: product.type,
                color: product.color,
                hex: product.hex,
              }
            );
            response.affectedItemsUpdate.push({
              sku: product.sku,
            });
          } else if (product.productCategoryId) {
            let accesory = await productParam.create({
              price: product.priceWithTax,
              stock: product.stock,
              productCategoryId: product.productCategoryId,
              name: product.name,
              priceWithTax: product.priceWithTax,
              priceWithoutTax: product.priceWithoutTax,
              sku: product.sku,
              warrantYear: product.warrantyear,
              active: product.active,
              collection: product.collection,
              brandId: product.brandId,
              description: product.description,
              material: product.material,
              type: product.type,
              color: product.color,
              hex: product.hex,
            });
            response.affectedItemsCreate.push({
              sku: product.sku,
            });
          } else {
            response.noCreateCategory.push({
              sku: product.sku,
              category: categoryInstance1 + " - _" + categoryInstance2,
            });
          }

          let productInstance = await productParam.upsertWithWhere(
            {
              sku: product.sku,
              brandId: product.brandId
            },
            {
              sku: product.sku,
              brandId: product.brandId
            },
            async function (err, res) {
              product.compatibility.map(async (productVarioation) => {
                // busco la serie
                let vehicleSerieInstance;
                console.log(productVarioation);
                try {
                  vehicleSerieInstance = await VehicleSerie.findOrCreate(
                    {
                      where: {
                        /* name: productVarioation.serie, */
                        name: product.brandId == 1
                          ? productVarioation.class
                          : productVarioation.serie,
                        brandId: product.brandId,
                      },
                    },
                    {
                      name: productVarioation.serie,
                      brandId: product.brandId,
                    }
                  );
                } catch (error) {
                  return error;
                }

                /*      // valido
                   if (!vehicleSerieInstance) {
                     return new Error(
                       `La serie ${productVarioation.Serie} y marca ${product.brandId} , no existe.`
                     )
                   }
      */

                // busco el modelo
                let vehicleModelInstance;
                try {
                  vehicleModelInstance = await VehicleModel.findOrCreate(
                    {
                      where: {
                        name: product.brandId == 2
                          ? productVarioation.class
                          : productVarioation.model,
                        vehicleSerieId: vehicleSerieInstance[0].id,
                      },
                    },
                    {
                      name: product.brandId == 2
                        ? productVarioation.class
                        : productVarioation.model,
                      vehicleSerieId: vehicleSerieInstance[0].id,
                    }
                  );
                } catch (error) {
                  throw error;
                }

                /*      console.log(vehicleModelInstance)
                   // valido
                   if (!vehicleModelInstance) {
                     return new Error(
                       `El modelo ${product.model} para la serie ${
                       vehicleSerieInstance.name
                       } que asu vez pertenece a la marca ${
                       product.brandId
                       }, no existe.`
                     )
                   }
      */

                // busco la carroceria
                let vehicleBodyWorkInstance;
                try {
                  vehicleBodyWorkInstance = await VehicleBodyWork.findOrCreate(
                    {
                      where: {
                        name: productVarioation.bodywork,
                      },
                    },
                    {
                      name: productVarioation.bodywork,
                    }
                  );
                } catch (error) {
                  return error;
                }
                // valido
                /*   if (!vehicleBodyWorkInstance) {
                  return new Error(`La carroceria ${productVarioation.bodywork}, no existe.`)
                } */
                // defino el objeto
                console.log(res);
                const productVariationObject = {
                  productId: res.id,
                  vehicleSerieId: vehicleSerieInstance[0].id,
                  vehicleModelId: vehicleModelInstance[0].id,
                  vehicleBodyWorkId: vehicleBodyWorkInstance[0].id,
                  yearEnd: productVarioation.yearEnd,
                  yearStart: productVarioation.yearStart,
                };

                console.log("productVariationObject");

                try {
                  await ProductVariation.findOrCreate(
                    {
                      where: productVariationObject,
                    },
                    productVariationObject,
                    (err, success) => {
                      if (success) {
                        /* console.log(success, " bien") */
                      } else {
                        /* console.log(err, " error") */
                      }
                    }
                  );
                } catch (error) {
                  return error;
                }
              });
            }
          );
          return productInstance;
        })
      );
    } else if (payload["tires"] && payload["tires"].length > 0) {
      await Promise.all(
        payload["tires"].map(async (product) => {
          const categoryInstance1 = await ProductCategory.findOne({
            where: {
              name: product.category,
              brandId: product.brandId,
            },
          });

          let categoryInstance2;
          if (product.subCategory != 0) {
            categoryInstance2 = await ProductCategory.findOne({
              where: {
                name: product.subCategory,
                brandId: product.brandId,
              },
            });
          }
          if (!categoryInstance1 || !categoryInstance2) {
            console.log(
              categoryInstance1,
              categoryInstance2,
              product.name,
              "Producto sin cargar"
            );
          } else {
            /* console.log(product, "Producto  cargar"); */
          }

          product.productCategoryId =
            product.subCategory == 0
              ? categoryInstance1.id
              : categoryInstance2.id;

          let isAccesory = await productParam.findOne({
            where: {
              sku: product.sku,
            },
          });
          if (isAccesory && product.productCategoryId) {
            let accesory = await productParam.updateAll(
              {
                sku: product.sku,
                brandId: product.brandId
              },
              {
                price: product.priceWithTax,
                stock: product.stock,
                productCategoryId: product.productCategoryId,
                name: product.name,
                priceWithTax: product.priceWithTax,
                priceWithoutTax: product.priceWithoutTax,
                sku: product.sku,
                warrantYear: product.warrantyear,
                width: product.width,
                active: product.active,
                collection: product.collection,
                brandId: product.brandId,
                description: product.description,
                material: product.material,
                type: product.type,
                color: product.color,
                hex: product.hex,
                scale: product.rin,
                indexRin: product.indexRin,
                productBrand: product.productBrand,
                runflat: product.runflat,
              }
            );
            response.affectedItemsUpdate.push({
              sku: product.sku,
            });
          } else if (product.productCategoryId) {
            let accesory = await productParam.create({
              price: product.priceWithTax,
              stock: product.stock,
              productCategoryId: product.productCategoryId,
              name: product.name,
              priceWithTax: product.priceWithTax,
              priceWithoutTax: product.priceWithoutTax,
              sku: product.sku,
              width: product.width,
              warrantYear: product.warrantyear,
              active: product.active,
              collection: product.collection,
              brandId: product.brandId,
              description: product.description,
              material: product.material,
              type: product.type,
              color: product.color,
              hex: product.hex,
              scale: product.rin,
              indexRin: product.indexRin,
              productBrand: product.productBrand,
              runflat: product.runflat,
            });
            response.affectedItemsCreate.push({
              sku: product.sku,
            });
          } else {
            response.noCreateCategory.push({
              sku: product.sku,
              category: categoryInstance1 + " - _" + categoryInstance2,
            });
          }

          let productInstance = await productParam.upsertWithWhere(
            {
              sku: product.sku,
            },
            {
              sku: product.sku,
            },
            async function (err, res) {
              product.compatibility.map(async (productVarioation) => {
                // busco la serie
                /*          let vehicleSerieInstance;
                console.log(productVarioation);
                try {
                  vehicleSerieInstance = await VehicleSerie.findOrCreate(
                    {
                      where: {
                        name: productVarioation.serie,
                        brandId: product.brandId,
                      },
                    },
                    {
                      name: productVarioation.serie,
                      brandId: product.brandId,
                    }
                  );
                } catch (error) {
                  return error;
                } */

                /*      // valido
                   if (!vehicleSerieInstance) {
                     return new Error(
                       `La serie ${productVarioation.Serie} y marca ${product.brandId} , no existe.`
                     )
                   }
      */

                // busco el modelo
                /*     let vehicleModelInstance;
                    try {
                      vehicleModelInstance = await VehicleModel.findOrCreate(
                        {
                          where: {
                            name: productVarioation,
                            vehicleSerieId: "motorrad",
                          },
                        },
                        {
                          name: productVarioation,
                          vehicleSerieId: "motorrad",
                        }
                      );
                    } catch (error) {
                      throw error;
                    } */

                /*      console.log(vehicleModelInstance)
                   // valido
                   if (!vehicleModelInstance) {
                     return new Error(
                       `El modelo ${product.model} para la serie ${
                       vehicleSerieInstance.name
                       } que asu vez pertenece a la marca ${
                       product.brandId
                       }, no existe.`
                     )
                   }
      */

                // busco la carroceria
                /*     let vehicleBodyWorkInstance;
                try {
                  vehicleBodyWorkInstance = await VehicleBodyWork.findOrCreate(
                    {
                      where: {
                        name: productVarioation.bodywork,
                      },
                    },
                    {
                      name: productVarioation.bodywork,
                    }
                  );
                } catch (error) {
                  return error;
                } */
                // valido
                /*   if (!vehicleBodyWorkInstance) {
                  return new Error(`La carroceria ${productVarioation.bodywork}, no existe.`)
                } */
                // defino el objeto
                /*      console.log(vehicleSerieInstance);
                     const productVariationObject = {
                       productId: res.id,
                       vehicleSerieId: 0,
                       vehicleModelId: vehicleModelInstance[0].id,
                       vehicleBodyWorkId: 0,
                     };
     
                     console.log("productVariationObject");
      */
                /*               try {
                                await ProductVariation.findOrCreate(
                                  {
                                    where: productVariationObject,
                                  },
                                  productVariationObject,
                                  (err, success) => {
                                    if (success) {
                                      console.log(success, " bien")
                                    } else {
                                      console.log(err, " error")
                                    }
                                  }
                                );
                              } catch (error) {
                                return error;
                              } */
              });
            }
          );
          return productInstance;
        })
      );
    } else {

      let products = await productParam.find({
        where: {
          isFather: true,
        },
        include: [
          {
            relation: 'imageProducts',
            scope: {
              fields: {
                image: true
              }
            }
          },
          {
            relation: 'skuVariations',
            scope: {
              include: [
                {
                  relation: 'productChildren'
                }
              ]
            }
          }
        ],
      });

      products.map(async product => {
        let temp = product.toJSON()
        let tempPrice = 0;
        let active = temp.skuVariations.some(temp => {
          if (temp.productChildren.active) {
            tempPrice = temp.productChildren.price;
          }
          return temp && temp.productChildren && temp.productChildren.stock > 0
        })
        if (active && temp.imageProducts.length > 0) {
          await productParam.updateAll(
            { sku: product.sku },
            {
              active: true,
            }
          );
          if (product.price == 0) {
            await productParam.updateAll(
              { sku: product.sku },
              {
                price: tempPrice,
              }
            )
          }
        }
      })

      return products;

    }

    return response;
  };

  productParam.remoteMethod("ProductsLoad", {
    accepts: {
      arg: "req",
      type: "object",
      http: {
        source: "req",
      },
    },
    http: {
      verb: "post",
      path: "/load",
    },
    returns: {
      arg: "data",
      type: "Object",
    },
  });
};
