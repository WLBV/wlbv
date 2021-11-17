
import http from 'http';
import dotenv from 'dotenv'
dotenv.config()
import { CryptoAlgorithm } from './js/algorithm.js'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

let runIntervalInMS = process.env.RUN_INTERVAL

let cryptoAlgorithm = new CryptoAlgorithm();

cryptoAlgorithm.runOnce();

function runAlgorithm(){
    let cryptoAlgorithm = new CryptoAlgorithm();
    cryptoAlgorithm.runOnce();
}

//setInterval(runAlgorithm, runIntervalInMS);




