import { createSocket } from 'dgram';
import { DEFAULT_REQUEST_TIMEOUT, MIN_REQUEST_TIMEOUT } from '../constants';

export interface IBaseRequestParams {
  server: string,
  request: string,
  timeout?: number,
}

/**
 *
 * @param params Object with keys:
 * request - request to the server,
 * ip - ip or domain name of the server
 * port - port (number 1-65534)
 * timeout - timer in secs after which request would be interrupted (min: 2, default: 10)
 * @returns string with server response or throws an error
 */
export const baseRequest = (params: IBaseRequestParams): Promise<string> => {
  const { ip, port, timeout, request } = validateAndParseInput(params);

  return new Promise<string>((resolve, reject) => {
    const packet = Buffer.from(`\xFF\xFF\xFF\xFF${request}`, 'latin1');
    const socket = createSocket('udp4');
    const msg: string[] = [];
    const listener = (response: Buffer) => msg.push(response.toString())
    const connection = socket.once('message', (response) => {
      msg.push(response.toString());
      // Coming below is required because response can come as a load of packets, not just one
      socket.on('message', listener);
      setTimeout(() => {
        connection.off('message', listener);
        resolve(msg.join(''));
      }, 2000);
    });
    socket.send(packet, 0, packet.length, port, ip);

    setTimeout(() => {
      connection.off('message', listener);
      reject('No response!')
    }, timeout * 1000);
  })
}

function validateAndParseInput (params: IBaseRequestParams): {
  ip: string, port: number, timeout: number, request: string,
} {
  const noParams = [];
  if (!params.server) noParams.push('server');
  if (!params.request) noParams.push('request');
  if (noParams.length > 0) throw new Error('Parameter "ip" is required!');
  if (params.timeout && params.timeout < MIN_REQUEST_TIMEOUT) throw new Error('Parameter "timeout" must be at least 1 second!');

  const { ip, port } = getIpAndPort(params.server)
  const timeout = params?.timeout || DEFAULT_REQUEST_TIMEOUT;
  return { ip, port, timeout, request: params.request };
}

function getIpAndPort(server: string): {
  ip: string, port: number,
} {
  const incorrectFormatErrorMessage =
  'Parameter "server" has incorrect format!\nRequired format: "server_ipv4_or_domainname:port"\ne.g. 242.9.9.9:29071 or server.com:30001';
  const array = server.split(':');
  if (array.length === 2) {
    // TODO: Add domain checker
    const [ip, port] = [array[0], parseInt(array[1])];
    if (typeof port !== 'number' || isNaN(port))
      throw new Error(incorrectFormatErrorMessage)
    else if (!(port > 0 && port < 65535))
      throw new Error('Port must be a number in range [1-65534]!')
    else return { ip, port };
  } else {
    throw new Error(incorrectFormatErrorMessage)
  }
}