/**
 * 百度地圖GL元件
 * 
 * 基於百度地圖WebGL API封裝的React地圖元件，支援自定義標記點、縮放級別等配置
 * 
 * 使用示例：
 * <Map
 *   ak="OeTpXHgdUrRT2pPyAPRL7pog6GlMlQzl" // 百度地圖API金鑰
 *   option={{
 *       address: "山東省威海市環翠區劉公島景區內",
 *       lat: 37.51029432858647, // 緯度
 *       lng: 122.19726116385918, // 經度
 *       zoom: 12, // 縮放級別
 *   }}
 *   className="w-[600px] h-[300px] rounded-lg" // 容器樣式
 * >
 *   <MapTitle className="text-md"/> // 可選標題元件
 * </Map>
 */

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from "react";

/** 地圖上下文屬性 */
type MapContextProps = {
// 地址
address?: string; /** 地圖示記點地址 */
};

const MapContext = createContext<MapContextProps | null>(null);

/** 預設地圖配置 */
const defaultOption = {
zoom: 15, /** 預設縮放級別 */
lng: 116.404, /** 預設經度(北京天安門) */
lat: 39.915, /** 預設緯度(北京天安門) */
address: "北京市東城區長安街", /** 預設地址 */
};

const loadScript = (src: string) => {
return new Promise<void>((ok, fail) => {
    const script = document.createElement("script");
    script.onerror = (reason) => fail(reason);

    if (~src.indexOf("{{callback}}")) {
    const callbackFn = `loadscriptcallback_${(+new Date()).toString(36)}`;
    (window as any)[callbackFn] = () => {
        ok();
        delete (window as any)[callbackFn];
    };
    src = src.replace("{{callback}}", callbackFn);
    } else {
    script.onload = () => ok();
    }

    script.src = src;
    document.head.appendChild(script);
});
};

const useMap = () => {
const context = useContext(MapContext);

if (!context) {
    return {};
}

return context;
};

/**
 * 地圖示題元件
 * @param {string} className - 自定義類名
 */
const MapTitle = ({ className }: React.ComponentProps<"div">) => {
const { address } = useMap();
if (!address) return null;
return <span className={`text-lg font-bold ${className}`}>{address}</span>;
};

// 記錄百度地圖SDK載入狀態
let BMapGLLoadingPromise: Promise<void> | null = null;

/**
 * 百度地圖主元件
 * @param {string} ak - 百度地圖API金鑰，預設為'OeTpXHgdUrRT2pPyAPRL7pog6GlMlQzl'
 * @param {object} option - 地圖配置選項
 * @param {number} option.zoom - 地圖縮放級別
 * @param {number} option.lng - 經度座標
 * @param {number} option.lat - 緯度座標
 * @param {string} option.address - 標記點地址
 * @param {string} className - 容器自定義類名
 * @param {ReactNode} children - 子元件，通常為MapTitle
 */
const Map = ({
ak,
option,
className,
children,
...props
}: React.ComponentProps<"div"> & {
ak: string;
option?: {
    zoom: number;
    lng: number;
    lat: number;
    address: string;
};
}) => {
const mapRef = useRef<HTMLDivElement>(null);
const currentRef = useRef(null);

const _options = useMemo(() => {
    return { ...defaultOption, ...option };
}, [option]);

const contextValue = useMemo<MapContextProps>(
    () => ({
    address: option?.address,
    }),
    [option?.address]
);

const initMap = useCallback(() => {
    if (!mapRef.current) return;

    let map = currentRef.current;

    if (!map) {
    // 建立地圖例項
    map = new (window as any).BMapGL.Map(mapRef.current);
    currentRef.current = map;
    }

    // 清除覆蓋物
    map.clearOverlays();

    // 設定地圖中心點座標和地圖級別
    const center = new (window as any).BMapGL.Point(
    _options?.lng,
    _options?.lat
    );

    map.centerAndZoom(center, _options?.zoom);

    // 新增標註
    const marker = new (window as any).BMapGL.Marker(center);
    map.addOverlay(marker);
}, [_options]);

useEffect(() => {
    // 檢查百度地圖API是否已載入
    if ((window as any).BMapGL) {
    initMap();
    } else if (BMapGLLoadingPromise) {
    BMapGLLoadingPromise.then(initMap).then(() => {
        BMapGLLoadingPromise = null;
    });
    } else {
    BMapGLLoadingPromise = loadScript(
        `//api.map.baidu.com/api?type=webgl&v=1.0&ak=${ak}&callback={{callback}}`
    );

    BMapGLLoadingPromise.then(initMap).then(() => {
        BMapGLLoadingPromise = null;
    });
    }
}, [ak, initMap]);

useEffect(() => {
    return () => {
    if (currentRef.current) {
        currentRef.current = null;
    }
    };
}, []);

return (
    <MapContext.Provider value={contextValue}>
    <div
        ref={mapRef}
        className={`w-full aspect-[16/9] ${className}`}
        {...props}
    ></div>
    {children}
    </MapContext.Provider>
);
};

export { Map, MapTitle };