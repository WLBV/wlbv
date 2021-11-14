import dotenv from 'dotenv'
dotenv.config()
import { Api } from "./api.js";
import { BinanceApi } from "./binanceApi.js";


var apiKey = process.env.API_KEY;
var api = new Api(apiKey);
var binanceApi = new BinanceApi(process.env.BAPI_KEY)

export class CryptoAlgorithm {
    async runOnce() {


        var account = await api.account();
        console.log(account);


        if(typeof account === "object" ){

            var symbolsToSell = account.symbols.filter(p => p.quantity > 0 && p.name != "USDT");
            console.log(symbolsToSell);
            if(symbolsToSell.length > 0){
                var orderHistory = await api.orderHistory();
                for(const s of symbolsToSell){
                    if(typeof orderHistory === "object"){
                        var price = await api.price({symbol: s.name});
                        console.log(price);

                  

                        var sHystory = await api.symbolHistory({
                            symbol: s.name,
                            interval: "1m"
                        })    
                        if(typeof sHystory === "object" && typeof price === "object"){

                            var lastOrder = orderHistory.reverse().find(o => o.symbol === s.name && o.side === "BUY")
                            var priceDiff = price.value - lastOrder.price;
                            console.log(s.name +": "+ priceDiff);
                            var lastFiverecords = sHystory.slice(Math.max(sHystory.length - 5, 1));

                            if(
                                priceDiff < 0 && this.isLowLimit(price.value, lastOrder.price)
                                ||
                                priceDiff > 0 && this.isHighLimit(price.value, lastOrder.price)
                            
                            ){
                                
                                await api.order({ symbol: s.name, side: 'SELL', quantity: s.quantity });
                                console.log("SELL: " + s.name + " " + s.quantity + " " + price.value + " =" +  priceDiff * s.quantity);
                            }
                        }
                    }
                    console.log("Before sell sleep");
                    await this.sleep(20000);
                    console.log("After sell sleep");

                }


            }
        }
            

        console.log("Before Midle sleep");
        await this.sleep(20000);
        console.log("After Midle sleep");

        var account = await api.account();
        console.log(account);

  

        if(typeof account === "object" ){
            var symbolsToBuy = account.symbols.filter(p => p.quantity == 0 );
            console.log(symbolsToBuy);
            if(account.estimatedValue > 100 && symbolsToBuy.length > 0){

                for(const s of symbolsToBuy){
                    var sHystory = await api.symbolHistory({
                        symbol: s.name,
                        interval: "1m"
                    });

                    var price = await api.price({symbol: s.name});
                    console.log(price);
                    
                    if(typeof sHystory === "object" && typeof price === "object"){
                    
                        var lastFiverecords = sHystory.slice(Math.max(sHystory.length - 5, 1));

                        if(this.isPriceRising(price, lastFiverecords)){

                            var amountToBuy = 50 / price.value;
                            await api.order({ symbol: s.name, side: 'BUY', quantity: amountToBuy });
                            console.log("BUY: " + s.name + " " + amountToBuy + " " + price.value);

                        }
                    }

                    console.log("Before Buy sleep");
                    await this.sleep(20000);
                    console.log("After Buy sleep");

                }

            }
        }

        
    }

    isPriceRising(currentPrice, historyArray){
        console.log(currentPrice.name);
        console.log(currentPrice.value);
        console.log(historyArray[0][4]);

        console.log(currentPrice.value >= historyArray[0][4]);

        return currentPrice.value >= historyArray[0][4]; // Close price

    }

    isPriceFailing(currentPrice, historyArray){
        var contor = 0;
        for(const h of historyArray){
            if(currentPrice.value < h[4]){
                contor++;
            }else{
                contor--;
            }
        }
        return contor > 0;
    }

    async isLowLimit(currentPrice, buyPrice){
        var failPercentageLimit = 0.1;
        var priceDiff = currentPrice - buyPrice;

        if(priceDiff > 0 ){
            return false;
        }else{
            var percent = (Math.abs(priceDiff) * 100) / buyPrice;

            return percent > failPercentageLimit
        }
    }

    async isHighLimit(currentPrice, buyPrice){
        var highPercentageLimit = 0.5;
        var priceDiff = currentPrice - buyPrice;

        if(priceDiff < 0 ){
            return false;
        }else{
            var percent = (priceDiff * 100) / buyPrice;

            return percent >= highPercentageLimit
        }
    }





    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    } 



}