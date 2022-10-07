import './style.css';
import {Map, View} from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import {transform} from "ol/proj";

let stopSearch = true;

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({
      source: new OSM()
    })
  ],
  view: new View({
    center: transform([35.1751, 31.7962], 'EPSG:4326', 'EPSG:3857'),
    zoom: 14
  })
});

async function geoCode(lat, lon) {

    const options = {
        method: 'GET',
        headers: {
        }
    };

    await fetch(`https://forward-reverse-geocoding.p.rapidapi.com/v1/reverse?lat=${lat}&lon=${lon}&accept-language=he&polygon_threshold=0.0`, options)
        .then((r) => r.json()).then( data => {
            console.log(data)
            const isWb = data['address']['country_code'] == "ps"
            let placeArray = []
            if (data['address']['suburb']) placeArray.push(data['address']['suburb'])
            if (data['address']['neighbourhood']) placeArray.push(data['address']['neighbourhood'])
            if (data['address']['village']) placeArray.push(data['address']['village'])
            if (data['address']['city']) placeArray.push(data['address']['city'])
            if (data['address']['state_district']) placeArray.push(data['address']['state_district'])
            // const placeArray = data['display_name'].split(',')
            getNLI(placeArray, isWb)
      })
}

function generateNliKeyword(place, isWb) {
    place = place.replace("Regional Council", "")
        .replace("Subdistrict", "")
        .replace("District", "")
        .replace("נפת", "")
        .replace("מחוז", "")

    return `${place}`.trim()

    // return `${place}*(${isWb ? "West Bank": "Israel"})*`.trim()
}


function getBoundingBox(centerPoint, distance) {
    //distance is in km
    let MIN_LAT, MAX_LAT, MIN_LON, MAX_LON, R, radDist, degLat, degLon, radLat, radLon, minLat, maxLat, minLon, maxLon, deltaLon;
    if (distance < 0) {
        return 'Illegal arguments';
    }
    // helper functions (degrees<–>radians)
    Number.prototype.degToRad = function () {
        return this * (Math.PI / 180);
    };
    Number.prototype.radToDeg = function () {
        return (180 * this) / Math.PI;
    };
    // coordinate limits
    MIN_LAT = (-90).degToRad();
    MAX_LAT = (90).degToRad();
    MIN_LON = (-180).degToRad();
    MAX_LON = (180).degToRad();
    // Earth's radius (km)
    R = 6378.1;
    // angular distance in radians on a great circle
    radDist = distance / R;
    // center point coordinates (deg)
    degLat = centerPoint[0];
    degLon = centerPoint[1];
    // center point coordinates (rad)
    radLat = degLat.degToRad();
    radLon = degLon.degToRad();
    // minimum and maximum latitudes for given distance
    minLat = radLat - radDist;
    maxLat = radLat + radDist;
    // minimum and maximum longitudes for given distance
    minLon = void 0;
    maxLon = void 0;
    // define deltaLon to help determine min and max longitudes
    deltaLon = Math.asin(Math.sin(radDist) / Math.cos(radLat));
    if (minLat > MIN_LAT && maxLat < MAX_LAT) {
        minLon = radLon - deltaLon;
        maxLon = radLon + deltaLon;
        if (minLon < MIN_LON) {
            minLon = minLon + 2 * Math.PI;
        }
        if (maxLon > MAX_LON) {
            maxLon = maxLon - 2 * Math.PI;
        }
    }
    // a pole is within the given distance
    else {
        minLat = Math.max(minLat, MIN_LAT);
        maxLat = Math.min(maxLat, MAX_LAT);
        minLon = MIN_LON;
        maxLon = MAX_LON;
    }
    return [
        minLon.radToDeg(),
        minLat.radToDeg(),
        maxLon.radToDeg(),
        maxLat.radToDeg()
    ];
};


async function getPOIs(mapCenter) {
    const bbox = getBoundingBox(mapCenter, 2)
    const query = encodeURI(`data=[out:json][timeout:2];(node["historic"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]});way["historic"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]});++relation["historic"](${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}););out+body;>;out+skel+qt;`)

    await fetch("https://overpass-api.de/api/interpreter", {
        "body": query,
        "method": "POST",
    }).then((r) => r.json()).then( data => {
        console.log(data)

        data.elements.forEach(poi => {
            console.log(poi.tags.name)
        })
    })

}


async function getNLI(placeArray, isWb) {
    document.querySelector("#nli_images").innerHTML = "Loading..."
    if (stopSearch || placeArray.length == 0) {
        document.querySelector("#nli_images").innerHTML = "No Records Found..."

        return
    }
    const keyword = generateNliKeyword(placeArray.shift(), isWb)
    console.log(keyword)

    const url = new URL("https://eu01.alma.exlibrisgroup.com/view/sru/972NNL_INST")
    const params = {
        version: 1.2,
        operation: 'searchRetrieve',
        recordSchema: 'marcxml',
        query: encodeURI(`alma.all_for_ui="${keyword}" and alma.local_field_999="PHOTOGRAPH" local_field_903="No restrictions" sortBy alma.main_pub_date/sort.ascending`),
        maximumRecords: 7
    }
    url.search = new URLSearchParams(params)

    console.log(url)
    document.querySelector('#placename').innerHTML = `Searching for results from ${keyword}`;

    await fetch(url)
        .then((r) => r.text())
        .then(str => new window.DOMParser().parseFromString(str, "text/xml"))
        .then( xmlDoc => {
            console.log(xmlDoc)

            const recordsCount = xmlDoc.getElementsByTagName("numberOfRecords")[0].childNodes[0].nodeValue;
            console.log(recordsCount)
            if (recordsCount == 0) {
                getNLI(placeArray, isWb)
            }
            else {
                document.querySelector('#nli_images').innerHTML = "";
                const records = xmlDoc.querySelector("records").querySelectorAll("recordData")


                records.forEach(record => {
                    const tag907 = record.querySelector("[*|tag='907']")
                    const tag245 = record.querySelector("[*|tag='245']")
                    let titleString = ""
                    if (tag245) {titleString = titleString + `${tag245.querySelector("[*|code='a']").innerHTML} `}
                    if (tag907) {
                        const image = document.createElement('img')
                        image.className = "nliImage"
                        image.src  = `https://rosetta.nli.org.il/delivery/DeliveryManagerServlet?dps_func=stream&dps_pid=${tag907.querySelector("[*|code='d']").innerHTML}`

                        image.title = titleString

                        document.querySelector('#nli_images').appendChild(image);
                    }
                });

            }
        })

}

let debounce
function onMoveStart(evt) {
    clearTimeout(debounce);
    stopSearch = true
}

function onMoveEnd(evt) {
    stopSearch = false
    const map = evt.map;
    const latLon = transform(map.getView().getCenter(), 'EPSG:3857', 'EPSG:4326')

    debounce = setTimeout(

    function () {
        geoCode(latLon[1], latLon[0])
    }, 1000);
    // getPOIs(latLon)
    console.log(latLon)
    console.log(getBoundingBox(latLon, 2))
}

map.on('moveend', onMoveEnd);
map.on('movestart', onMoveStart);