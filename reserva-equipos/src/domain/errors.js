export class ErrorDominio extends Error {
  constructor(codigo, mensaje, status = 400) {
  super(mensaje);
  this.name = 'ErrorDominio';
  this.codigo = codigo;
  this.status = status;
  }
}
