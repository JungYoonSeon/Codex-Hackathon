import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Text, View } from "react-native";
import { Button, Notice, ui } from "../../ui";
import { Chip, s } from "../home-profile/components";
import StylePreferences from "./StylePreferences";
import { styleRank } from "./preferences";
import {
  discoveryDemoProducts,
  productCategories,
} from "../../../shared/discovery";

export default function FurnitureForYou({
  room,
  onPreferences,
  connection,
  onSave,
  onTry,
  onSearch,
  compact = false,
}) {
  const [category, setCategory] = useState("all");
  const [products, setProducts] = useState(discoveryDemoProducts);
  const [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [ai, setAI] = useState(null),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const prefKey = `${room?.id}-${room?.mood}-${room?.color}-${category}-${connection.origin}-${connection.token}`;
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 15000);
    setAI(null);
    setMessage("");
    setLoading(true);
    if (!connection.origin || !connection.token) {
      setProducts(
        discoveryDemoProducts.filter(
          (p) => category === "all" || p.category === category,
        ),
      );
      setLoading(false);
      setMessage("Sample catalog · connect stores to see actual products.");
      clearTimeout(timer);
      return () => {
        active = false;
      };
    }
    fetch(
      `${connection.origin}/products?source=all&category=${encodeURIComponent(category)}&sort=relevance&page=1`,
      {
        headers: { Authorization: `Bearer ${connection.token}` },
        signal: abort.signal,
      },
    )
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !Array.isArray(body.products))
          throw new Error(body.message || "Could not load products.");
        if (active) {
          const actual = body.products.filter((p) => p.dataMode !== "demo");
          setProducts(actual.length ? actual : body.products);
          setMessage(
            actual.length
              ? "Current catalog page · style ranking uses this list."
              : "Only sample products are available from the connected sources.",
          );
        }
      })
      .catch((e) => {
        if (active) {
          setProducts([]);
          setMessage(
            e.name === "AbortError"
              ? "Product search timed out. Use Search all stores to retry."
              : e.message,
          );
        }
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      abort.abort();
    };
  }, [category, connection.origin, connection.token]);
  useEffect(() => {
    generation.current++;
    setAI(null);
    setBusy(false);
  }, [prefKey, products]);
  const ranked = styleRank(products, room ?? {});
  const aiCurrent = ai?.key === prefKey ? ai : null;
  const visible = aiCurrent
    ? aiCurrent.items
        .map((item) => ({
          product: products.find((p) => p.id === item.id),
          reason: item.reason,
        }))
        .filter((v) => v.product)
    : ranked;
  async function recommend() {
    const id = ++generation.current;
    setBusy(true);
    setMessage("");
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const response = await fetch(
        `${connection.origin}/style-recommendations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${connection.token}`,
            "Content-Type": "application/json",
          },
          signal: abort.signal,
          body: JSON.stringify({
            mood: room?.mood ?? "",
            color: room?.color ?? "",
            products: products
              .slice(0, 40)
              .map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                description: (p.description ?? "").slice(0, 1500),
                tags: (p.tags ?? []).slice(0, 20),
              })),
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.message || "AI recommendation unavailable.");
      if (
        !Array.isArray(body.items) ||
        body.items.some((item) => !products.some((p) => p.id === item.id))
      )
        throw new Error("Recommendations did not match this product list.");
      if (id === generation.current) {
        setAI({ key: prefKey, items: body.items });
        setMessage(
          "OpenAI style shortlist · fit and delivery checks are separate.",
        );
      }
    } catch (e) {
      if (id === generation.current)
        setMessage(
          `${e.name === "AbortError" ? "AI recommendation timed out." : e.message} Showing catalog tag matches instead.`,
        );
    } finally {
      clearTimeout(timer);
      if (id === generation.current) setBusy(false);
    }
  }
  return (
    <View>
      <Text style={ui.sectionTitle}>Furniture for you!</Text>
      <Text style={s.small}>
        {room
          ? `For ${room.name}`
          : "Choose or create a room to save preferences."}
      </Text>
      {room && <StylePreferences value={room} onChange={onPreferences} />}
      <View style={s.row}>
        {productCategories.map((c) => (
          <Chip
            key={c.id}
            title={c.label}
            selected={category === c.id}
            onPress={() => setCategory(c.id)}
          />
        ))}
      </View>
      <Button
        secondary
        title={busy ? "Selecting with OpenAI…" : "Refine this list with OpenAI"}
        disabled={
          busy ||
          loading ||
          !products.length ||
          !connection.origin ||
          !connection.token
        }
        onPress={recommend}
      />
      {!connection.origin || !connection.token ? (
        <Text style={s.small}>
          AI 추천 서비스에 연결 중입니다. 잠시 후 다시 시도해 주세요.
        </Text>
      ) : null}
      {message ? (
        <Text accessibilityLiveRegion="polite" style={s.small}>
          {message}
        </Text>
      ) : null}
      {loading ? <ActivityIndicator /> : null}
      {!loading && !visible.length ? (
        <Notice>
          No matching products in this list. Try another category or Search all
          stores.
        </Notice>
      ) : null}
      {visible.slice(0, compact ? 4 : 20).map(({ product: p, reason }) => (
        <View key={p.id} style={ui.card}>
          {p.imageUrl ? (
            <Image
              source={{ uri: p.imageUrl }}
              style={{ height: 120, width: "100%" }}
              resizeMode="contain"
            />
          ) : null}
          <Text style={ui.sectionTitle}>{p.name}</Text>
          <Text style={s.small}>
            {p.sourceLabel} ·{" "}
            {p.dataMode === "demo" ? "Fictional sample" : "Catalog product"}
            {p.price
              ? ` · ${p.price.currency} ${p.price.amount.toLocaleString()}`
              : ""}
          </Text>
          <Text style={s.small}>{reason}</Text>
          <View style={s.row}>
            <Button
              small
              secondary
              title={
                room?.products.some((v) => v.id === p.id)
                  ? "Saved to room"
                  : "Save to room"
              }
              disabled={!room || room.products.some((v) => v.id === p.id)}
              onPress={() => onSave(p)}
            />
            <Button small title="Visualize" onPress={() => onTry(p)} disabled={!room}/>
          </View>
        </View>
      ))}
      <Button
        secondary
        title="Search all stores"
        onPress={onSearch}
      />
    </View>
  );
}
