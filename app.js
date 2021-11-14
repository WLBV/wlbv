
import http from 'http';
import dotenv from 'dotenv'
dotenv.config()
import { CryptoAlgorithm } from './js/algorithm.js'



let runIntervalInMS = process.env.RUN_INTERVAL

let cryptoAlgorithm = new CryptoAlgorithm();

//cryptoAlgorithm.runOnce()

function runAlgorithm(){
    let cryptoAlgorithm = new CryptoAlgorithm();
    cryptoAlgorithm.runOnce();
}


const hostname = '127.0.0.1';
const port = process.env.PORT;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Cripto Bot');
});

server.listen(process.env.PORT || port, hostname, () => {
  console.log(`Server running at http://${hostname}:${process.env.PORT}/`);
  setInterval(runAlgorithm, runIntervalInMS);
});



