import axios from "axios";
var API_URL = 'https://api.binance.com/api/v3';

var binanceClient;

export class BinanceApi {   
    constructor(key) {
        binanceClient = axios.create(
            {
                baseURL: 'https://api.binance.com/api/v3',
                timeout: 1000,
            }
        ) ;

        binanceClient.defaults.headers.common['key'] = key;

        //axios.defaults.headers.common['APIKEY'] = key;
        // console.log("Binance");
        // console.log(binanceClient.defaults.headers);
    }

    async tickerPrice(params) {
        return this.get('/ticker/price', {params})
            .then((response) => response.data);
    }


    async get(path, data) {
        return binanceClient
          .get(`${path}`, data)
          .then((response) => response)
          .catch((error) => {
                console.log(error.response);
                return Promise.resolve({data: "Error! Check the browser's console!"});
            });
    }

    async post(path, data) {
        return binanceClient
          .post(`${path}`, data)
          .then((response) => response)
          .catch((error) => {
                console.log(error.response);
                return Promise.resolve({data: "Error! Check the browser's console!"});
            });
    }
}
