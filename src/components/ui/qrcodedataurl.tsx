/**
 * 二維碼生成元件
 * 
 * 基於QRCode.js的React封裝元件，可將任意文字轉換為二維碼圖片
 * 
 * 使用示例：
 * import QRCodeDataUrl from './components/qrcodedataurl'
 * 
 * function App() {
 *   return <QRCodeDataUrl text="https://example.com" /> // 替換為有效URL
 * }
 */

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface QRCodeDataUrlProps {
  /** 
   * 需要編碼為二維碼的文字內容
   * 可以是URL、文字、聯絡方式等
   * 示例: "https://example.com" 或 "CONTACT:1234567890"
   */
  text: string;

  /**
   * 二維碼圖片寬度(畫素)
   * @default 128
   */
  width?: number;

  /**
   * 二維碼前景色(有效CSS顏色值)
   * @default "#000000" (黑色)
   */
  color?: string;

  /**
   * 二維碼背景色(有效CSS顏色值) 
   * @default "#ffffff" (白色)
   */
  backgroundColor?: string;

  /**
   * 自定義CSS類名
   */
  className?: string;
}

/**
 * 二維碼生成元件
 * @param {QRCodeDataUrlProps} props - 元件屬性
 */
const QRCodeDataUrl: React.FC<QRCodeDataUrlProps> = ({
  text,
  width = 128,
  color = '#000000',
  backgroundColor = '#ffffff',
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    const generateQR = async () => {
      try {
        const url = await QRCode.toDataURL(text, {
          width,
          color: {
            dark: color,
            light: backgroundColor,
          },
        });
        setDataUrl(url);
      } catch (err) {
        console.error('生成二維碼失敗:', err);
      }
    };

    generateQR();
  }, [text, width, color, backgroundColor]);

  return (
    <div className={`qr-code-container ${className}`}>
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={`二維碼: ${text}`}
          width={width}
          height={width}
        />
      ) : (
        <div>生成二維碼中...</div>
      )}
    </div>
  );
};

export default QRCodeDataUrl;