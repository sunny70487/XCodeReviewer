import { Helmet, HelmetProvider } from "react-helmet-async";
import { ReactNode } from "react";

interface PageMetaProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
}

interface AppWrapperProps {
  children: ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  return (
    <HelmetProvider>
      {children}
    </HelmetProvider>
  );
}

export default function PageMeta({
  title = "XCodeReviewer",
  description = "基於AI的現代化程式碼質量分析和審查服務，提供全面的程式碼安全檢測、效能分析和最佳實踐建議。",
  keywords = "程式碼審計,程式碼質量,AI分析,安全檢測,效能最佳化,程式碼規範",
  image = "/images/logo.png",
  url = window.location.href
}: PageMetaProps) {
  const fullTitle = title === "XCodeReviewer" ? title : `${title} - XCodeReviewer`;

  return (
    <Helmet>
      {/* 基本資訊 */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="XCodeReviewer" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* 其他 */}
      <meta name="robots" content="index, follow" />
      <meta name="author" content="XCodeReviewer" />
      <link rel="canonical" href={url} />
    </Helmet>
  );
}