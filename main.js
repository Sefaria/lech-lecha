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
    await fetch(`https://nominatim.openstreetmap.org/reverse?format=geojson&lat=${lat}&lon=${lon}&zoom=14&accept-language=en`)
        .then((r) => r.json()).then( data => {
            const isWb = data['features'][0]['properties']['address']['country_code'] == "ps"
            const placeArray = data['features'][0]['properties']['display_name'].split(',')
            getNLI(placeArray, isWb)
      })
}

function generateNliKeyword(place, isWb) {
    place = place.replace("Regional Council", "")
        .replace("Subdistrict", "")
        .replace("District", "")
    return `${place}`.trim()

    // return `${place}*(${isWb ? "West Bank": "Israel"})*`.trim()
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
                    if (tag907) {
                        const image = document.createElement('img')
                        image.className = "nliImage"
                        image.src  = `https://rosetta.nli.org.il/delivery/DeliveryManagerServlet?dps_func=stream&dps_pid=${tag907.querySelector("[*|code='d']").innerHTML}`
                        document.querySelector('#nli_images').appendChild(image);
                    }
                });

            }
        })

}

function onMoveStart(evt) {
    stopSearch = true
}

function onMoveEnd(evt) {
  stopSearch = false
  const map = evt.map;
  const latLon = transform(map.getView().getCenter(),'EPSG:3857', 'EPSG:4326')
  geoCode(latLon[1], latLon[0])
  console.log(
      transform(
        map.getView().getCenter(),
        'EPSG:3857', 'EPSG:4326'
      )

      )
  // const extent = map.getView().calculateExtent(map.getSize());
  // const bottomLeft = toLonLat(getBottomLeft(extent));
  // const topRight = toLonLat(getTopRight(extent));
  // display('left', wrapLon(bottomLeft[0]));
  // display('bottom', bottomLeft[1]);
  // display('right', wrapLon(topRight[0]));
  // display('top', topRight[1]);
}

map.on('moveend', onMoveEnd);
map.on('movestart', onMoveStart);