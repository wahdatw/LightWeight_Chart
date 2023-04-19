// import logo from './logo.svg';
import './App.css';
import { createChart, ColorType } from 'lightweight-charts';
import React, { useEffect, useRef, useState } from 'react';
import { createClient, cacheExchange, fetchExchange } from 'urql'
import { isAddress } from "ethers";
// import Web3 from "web3"
// import pairAbi from "./abi/pair.json"

const APIURL = 'https://api.thegraph.com/subgraphs/name/hwakstar/exchange_subgraph';
// const rpcurl = "https://eth-goerli.public.blastapi.io";

// let web3 = new Web3(rpcurl)

const client = createClient({
	url: APIURL,
	exchanges: [cacheExchange, fetchExchange]
})

let multi=0;

function App(props) {


	const [token0, setToken0] = useState("0xae8dc6d964c2ac786bed908e5a1305acf7d2330a");
	const [token1, setToken1] = useState("0xb4fbf271143f4fbf7b91a5ded31805e42b2208d6");
	const [timeselect, setTimeselect] = useState("");
	const [pair, setPair] = useState("");
	const [pairToken0, setPairToken0] = useState(null);
	const [pairToken1, setPairToken1] = useState(null);
	const [graphData, setGraphData] = useState([]);
	//  const time_gap = 600
	
	console.log(pair);
	const confirm = async () => {
		if (isAddress(token0) && isAddress(token1)) {
			const pairQuery = `
			query {
				pairs(where: {token0_: {id: "${token0.toLocaleLowerCase()}"}, token1_: {id: "${token1.toLocaleLowerCase()}"}}) {
				  id
				  token0 {
					id
					name
					symbol
					decimals
				  }
				  token1 {
					id
					name
					symbol
					decimals
				  }
				}
			  }
			`

			const data = await client.query(pairQuery).toPromise()
			if (data) {
				
				let pair_id = data.data.pairs[0].id				
				setPair(pair_id)
				setPairToken0(data.data.pairs[0].token0)
				setPairToken1(data.data.pairs[0].token1)
				fetchPairData(data.data.pairs[0])
			}
		} else {
			alert("invalid address")
		}

	}

	const getSwapPrice = async (startTime, pair) => {
		const PairDataQuery = `
			query {
				swaps(
					where: {pair: "${pair.id}", timestamp_gt: "${startTime}"} 
					orderBy: timestamp
					orderDirection: asc
					first: 1
				) {
					amount0Out
					amount1In
					amount1Out
					amount0In
					timestamp
				}
			}
		`
		const data = await client.query(PairDataQuery).toPromise()

		if (data.data.swaps[0]) {
			let swapDetail = data.data.swaps[0]
			// console.log(swapDetail)
			let price = 0
			if (token0.toLocaleLowerCase() === pair.token0.id.toLocaleLowerCase()) {
				price = Number(swapDetail.amount0In) > 0 ? swapDetail.amount1Out / swapDetail.amount0In * Math.pow(10, (pair.token0.decimals - pair.token1.decimals)) : swapDetail.amount1In / swapDetail.amount0Out * Math.pow(10, (pair.token0.decimals - pair.token1.decimals))
			} else {
				price = Number(swapDetail.amount0In) > 0 ? swapDetail.amount0In / swapDetail.amount1Out * Math.pow(10, (pair.token1.decimals - pair.token0.decimals)) : swapDetail.amount0Out / swapDetail.amount1In * Math.pow(10, (pair.token1.decimals - pair.token0.decimals))
			}
			return {
				timestamp: swapDetail.timestamp, price
			}
		} else {
			return {
				timestamp: 0,
				price: 0
			}
		}
	}
	const getSwapPrices = async (startTime, pair, skip = 0) => {
		const PairDataQuery = `
			query {
				swaps(
					where: {pair: "${pair.id}", timestamp_gt: "${startTime}"} 
					orderBy: timestamp
					orderDirection: asc
					first: 1000
					skip: ${skip * 1000}
				) {
					amount0Out
					amount1In
					amount1Out
					amount0In
					timestamp
				}
			}
		`
	
		const data = await client.query(PairDataQuery).toPromise()
		let swapDetails = data.data.swaps.map(swapDetail => {
			let price = 0
			if (token0.toLocaleLowerCase() === pair.token0.id.toLocaleLowerCase()) {
				price = Number(swapDetail.amount0In) > 0 ? swapDetail.amount1Out / swapDetail.amount0In * Math.pow(10, (pair.token0.decimals - pair.token1.decimals)) : swapDetail.amount1In / swapDetail.amount0Out * Math.pow(10, (pair.token0.decimals - pair.token1.decimals))
			} else {
				price = Number(swapDetail.amount0In) > 0 ? swapDetail.amount0In / swapDetail.amount1Out * Math.pow(10, (pair.token1.decimals - pair.token0.decimals)) : swapDetail.amount0Out / swapDetail.amount1In * Math.pow(10, (pair.token1.decimals - pair.token0.decimals))
			}
			return {
				timestamp: swapDetail.timestamp,
				price
			}
		})
		if (swapDetails.length > 1000) {
			swapDetails = swapDetails.concat(await getSwapPrices(startTime, pair, ++skip))
		}
		return swapDetails
	}
	const fetchPairData = async (pair) => {
		if (isAddress(pair.id)) {
			let currentTime = (Date.now() / 1000).toFixed(0);
			let startTime = currentTime - 2728000;
			
			let swapPrices = await getSwapPrices(startTime, pair)
			let time_gap;
			console.log("time_select", timeselect)
			if (timeselect ===60) {
				time_gap = 3600
			}
			else if (timeselect === 5) {
				time_gap = 300
			}
			else if (timeselect === 15) {
				time_gap = 900
			}
			else {
				time_gap = 60
			}
			console.log(time_gap)
			// get first price
			let firstPrice = await getSwapPrice(startTime, pair)
			// console.log(swapPrices)

			let result = [];
			let temp_result=[];
			if (swapPrices.length) {
				let startBlankIndexesLength = Math.ceil((swapPrices[0].timestamp - startTime) / time_gap)
				for (let i = 0; i < startBlankIndexesLength; i++) {
					if (startTime > Number(firstPrice.timestamp)) {

						// console.log("first price",100000*firstPrice.price)
						result.push({ time: startTime, value: firstPrice.price })
						temp_result.push({ time: startTime, value: firstPrice.price })

					} else {
						result.push({ time: startTime, value: 0 })
						temp_result.push({ time: startTime, value: 0 })
					}
					startTime += time_gap
				}
				// console.log("swapPrices",swapPrices);
				// console.log((swapPrices))
				swapPrices.map((swapPrice, index) => {
					if (Number(swapPrice.timestamp) > startTime) {
						let blankIndexesLength = Math.ceil((swapPrice.timestamp - startTime) / time_gap)
						for (let i = 0; i < blankIndexesLength; i++) {
							// console.log("swap", 100000*swapPrices[index - 1].price)
							result.push({ time: startTime, value: swapPrices[index - 1].price })
							temp_result.push({ time: startTime, value: swapPrices[index - 1].price })

							startTime += time_gap
						

						}

					}
					result[result.length - 1].value = swapPrice.price
					temp_result[temp_result.length - 1].value = swapPrice.price
					return 0;
				})
			}
			let endBlankIndexesLength = Math.floor((currentTime - result[result.length - 1].time) / time_gap)
			for (let i = 0; i < endBlankIndexesLength; i++) {
			
				result.push({ time: startTime, value: result[result.length - 1].value * 1 })
				temp_result.push({ time: startTime, value: result[result.length - 1].value * 1 })

				startTime += time_gap
			}

			// let pairContract = new web3.eth.Contract(pairAbi, pair.id)
			// let reserves = await pairContract.methods.getReserves().call()
			// if (token0.toLocaleLowerCase() === pair.token0.id.toLocaleLowerCase()) {
				// let currentPrice = (reserves[1] / Math.pow(10, pair.token1.decimals)) / (reserves[0] / Math.pow(10, pair.token0.decimals))
				// result[result.length - 1].value = currentPrice
				// temp_result[temp_result.length - 1].value = currentPrice
			// } else {
				// let currentPrice = (reserves[0] / Math.pow(10, pair.token0.decimals)) / (reserves[1] / Math.pow(10, pair.token1.decimals))
				// result[result.length - 1].value = currentPrice
				// temp_result[temp_result.length - 1].value = currentPrice
			// }
		
		
			for (let j = 0; j < result.length; j++) {		
			
				
				while (result[j].value < 1 && result[j].value !== 0) {
					
					result[j].value = result[j].value * 10;

				}
				
				// result[j].value = result[j].value / 10;		
			


			}
			console.log(result);
			console.log(temp_result[45000].value)
			multi=temp_result[45000].value/result[45000].value;
			console.log(multi,"Hi")			
		   console.log(result[45000].value)
			setGraphData(result)

		}
	}
	const renderTokenPairName = () => {
		if (!pairToken0) return "-/-"
		if (token0.toLocaleLowerCase() === pairToken0.id.toLocaleLowerCase()) {
			return `${pairToken0.symbol}/${pairToken1.symbol}`
		} else {
			return `${pairToken1.symbol}/${pairToken0.symbol}`
		}
	}
	return (
		<div className="App">
			<h1>{renderTokenPairName()}</h1>
			<ChartComponent {...props} data={graphData} ></ChartComponent>
			<div>


			</div>
			<div style={{ display: "flex" }}>
				<div style={{ width: "60%" }}>
					<label>Token 0 -</label>
					<input type="text" value={token0} onChange={(e) => setToken0(e.target.value)} style={{ width: "330px" }} />
				</div>
				<div>
					<label>Token 1 -</label>
					<input type="text" value={token1} onChange={(e) => setToken1(e.target.value)} style={{ width: "330px" }} />

					<select name="timeselect" value={timeselect} onChange={(e) => { setTimeselect(e.target.value) }} style={{ marginLeft: "20px" }}>
						<option value="1">1 minute</option>
						<option value="5">5 minutes</option>
						<option value="15">15 minutes</option>
						<option value="60">1 hour</option>
					</select>
					<button type='button' onClick={() => confirm()} style={{ marginLeft: "10px" }}>Confirm</button>

				</div>

			</div>

		</div>
	);
}

export default App;

export const ChartComponent = props => {
	const {
		data,
		colors: {
			backgroundColor = 'white',
			lineColor = '#2962FF',
			textColor = 'black',
			areaTopColor = '#2962FF',
			areaBottomColor = 'rgba(41, 98, 255, 0.28)',
		} = {},
		
	} = props;

	const chartContainerRef = useRef();
	const myPriceFormatter = (p) => {
			// for(let m=0;m<mult-1;m++){
			// 	divide*=10;
			// }
			// console.log(divide)
		return (p*multi).toFixed(14);
	}
	useEffect(
		() => {
			const handleResize = () => {
				chart.applyOptions({ width: chartContainerRef.current.clientWidth });

			};
			const chart = createChart(chartContainerRef.current, {
				layout: {
					background: { type: ColorType.Solid, color: backgroundColor },
					textColor,
				},

				width: chartContainerRef.current.clientWidth,
				height: 400,

			});
			chart.addLineSeries({
				autoscaleInfoProvider: () => ({
					priceRange: {
						minValue: 0,
						maxValue: 100,
					},
					margins: {
						above: 0,
						below: 0,
					},
				}),
			});
			// Adjust the options for the priceScale of the mainSeries

			chart.applyOptions({
				autoScale: false,

				localization: {
					priceFormatter: myPriceFormatter,
				},

			});
			chart.timeScale().fitContent();


			const newSeries = chart.addAreaSeries({ lineColor, topColor: areaTopColor, bottomColor: areaBottomColor });
			newSeries.setData(data);

			window.addEventListener('resize', handleResize);

			return () => {
				window.removeEventListener('resize', handleResize);

				chart.remove();
			};
		},
		[data, backgroundColor, lineColor, textColor, areaTopColor, areaBottomColor]
	);


	return (
		<div
			ref={chartContainerRef}
		/>
	);
};