require('dotenv').config();
const ccxt = require('ccxt');
const axios = require('axios');
const readlineSync = require('readline-sync')

const tick = async (config, binanceClient) => {

    const { tradingCurrency, baseCurrency, difference, tradingAmount } = config;
    const market = `${tradingCurrency}/${baseCurrency}`;  // market key
    
    // Get actual market price using coingecko API
    const marketPrice = await getMarketPrice();
    
    // Cancel orders of previous tick
    const orders = await binanceClient.fetchOpenOrders(market);
    orders.forEach(async order => {
        await binanceClient.cancelOrder(order.id);
    });

    // new orders config
    const sellPrice = marketPrice * (1 + difference);
    const balances = await binanceClient.fetchBalance();
    const tradingCurrencyBalance = balances.free[tradingCurrency] || 0;
    const baseCurrencyBalance = balances.free[baseCurrency] || 0;
    let sellVolume = parseFloat(tradingAmount);
    if( tradingAmount.endsWith('%') )
        sellVolume = tradingCurrencyBalance * parseFloat(tradingAmount) / 100.0

    console.log("Balance: ", tradingCurrency, tradingCurrencyBalance, baseCurrency, baseCurrencyBalance)

    // Create limit sell order
    await binanceClient.createLimitSellOrder(market, sellVolume, sellPrice);

    console.log(`
        New tick for ${market}...
        Created Limit sell order for ${sellVolume}@${sellPrice}
    `);

}

const buyTradingCrypto = async ({ buyingAmount, baseCurrency, tradingCurrency }, binanceClient) => {
    if( buyingAmount ) {
        const symbol = `${tradingCurrency}/${baseCurrency}`
        try{
            const order = await binanceClient.createOrder(symbol, 'market', 'buy', buyingAmount)
            console.log(order)
            return true
        }catch (e){
            console.error(e)
        }
    }
    return false
}

const getMarketPrice = async () => {
    // Get actual market price using coingecko API
    const results = await Promise.all([
        axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'),
        axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd')
    ]);
    console.log("Current Market Price:")
    const bitcoin = results[0].data.bitcoin.usd
    const usdt = results[1].data.tether.usd
    console.log("bitcoin", bitcoin, "usdt", usdt)

    return bitcoin / usdt
}

const run = async () => {
    const marketPrice = await getMarketPrice()
    const baseCurrency = await readlineSync.question("Enter Base Currency (e.g. USDT)\n")
    const buyingAmount = await readlineSync.question("Enter buying amount of Trading Currency (e.g. 1,000)\n")
    const tradingAmount = await readlineSync.question("Enter selling amount of Trading Currency (e.g. 0.1, 30%)\n")
    const difference = await readlineSync.question("Enter a price difference in % (e.g. 20)\n")
    const tradingCurrency = await readlineSync.question("Enter the Trading Currency (e.g. BTC)\n")

    const config = {
        baseCurrency,       // Trading crypto
        tradingCurrency,       // Trading against
        buyingAmount: parseFloat(buyingAmount),    // % of money in portfolio for each trade
        tradingAmount,
        difference: parseFloat(difference) / 100.0,        // % for Buy and sell limit order
    }

    // Instantiate binance client
    const binanceClient = new ccxt.binance({
        apiKey: process.env.BINANCE_API_KEY,
        secret: process.env.BINANCE_API_SECRET,
        options: {
            adjustForTimeDifference: true
        }
    });

    if ( config.buyingAmount != 0 && !(await buyTradingCrypto(config, binanceClient)) ){
        console.error('buying trading crypto failed')
        return
    }

    await tick(config, binanceClient);

}

// Execute bot
run();