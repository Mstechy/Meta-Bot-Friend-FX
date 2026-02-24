import { useState } from "react";
import { TRADING_VIDEOS, TRADING_TIPS } from "@/lib/tradingData";
import { Play, BookOpen, Lightbulb, ExternalLink, ArrowLeft, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const Education = () => {
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center gap-3 md:gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base md:text-xl font-bold text-foreground">Trading Academy</h1>
          <p className="text-xs md:text-sm text-muted-foreground truncate">Learn forex trading from beginner to advanced</p>
        </div>
        <Button variant="outline" size="sm" className="text-xs hidden sm:flex" onClick={() => navigate("/trading")}>
          <Activity className="w-3.5 h-3.5 mr-1" /> Trade Now
        </Button>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-8 md:space-y-10">
        {/* Video Player */}
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="aspect-video w-full max-w-4xl mx-auto rounded-lg overflow-hidden border border-border"
          >
            <iframe
              src={selectedVideo}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </motion.div>
        )}

        {/* Videos Grid */}
        <section>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Play className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            <h2 className="text-base md:text-lg font-semibold text-foreground">Video Courses</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {TRADING_VIDEOS.map((video) => (
              <motion.div
                key={video.id}
                whileHover={{ scale: 1.02 }}
                className="trading-panel overflow-hidden cursor-pointer group"
                onClick={() => setSelectedVideo(video.url)}
              >
                <div className="relative aspect-video bg-secondary">
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-background/80 rounded text-[10px] font-mono text-foreground">
                    {video.duration}
                  </div>
                </div>
                <div className="p-3">
                  <Badge variant="outline" className="mb-1 text-[10px]">{video.category}</Badge>
                  <h3 className="text-xs md:text-sm font-medium text-foreground line-clamp-2">{video.title}</h3>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Trading Tips */}
        <section>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <Lightbulb className="w-4 h-4 md:w-5 md:h-5 text-accent" />
            <h2 className="text-base md:text-lg font-semibold text-foreground">Essential Trading Tips</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {TRADING_TIPS.map((tip, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="trading-panel p-3 md:p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] md:text-xs font-bold text-accent">{i + 1}</span>
                  </div>
                  <div>
                    <h3 className="text-xs md:text-sm font-semibold text-foreground mb-1">{tip.title}</h3>
                    <p className="text-[10px] md:text-xs text-muted-foreground leading-relaxed">{tip.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Resources */}
        <section>
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <BookOpen className="w-4 h-4 md:w-5 md:h-5 text-trading-blue" />
            <h2 className="text-base md:text-lg font-semibold text-foreground">External Resources</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {[
              { title: "MetaTrader 5 Official", url: "https://www.metatrader5.com/", desc: "Download MT5 and access the full trading platform" },
              { title: "Babypips School of Pipsology", url: "https://www.babypips.com/learn/forex", desc: "Free comprehensive forex education" },
              { title: "TradingView", url: "https://www.tradingview.com/", desc: "Advanced charting and community analysis" },
              { title: "Investopedia Forex", url: "https://www.investopedia.com/forex-4427707", desc: "Forex trading education and glossary" },
            ].map((resource) => (
              <a
                key={resource.title}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="trading-panel p-3 md:p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-trading-blue flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs md:text-sm font-semibold text-foreground">{resource.title}</h3>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">{resource.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Education;
