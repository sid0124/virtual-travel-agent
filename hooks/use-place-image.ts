"use client"

import { useEffect, useMemo, useState } from "react"

import {
  type PlaceImageInput,
  type ResolvedPlaceImage,
  buildImageUnavailablePlaceholder,
  buildPlaceImageBlurPlaceholder,
  buildPlaceImageKey,
  buildPlaceImageQuery,
  isRenderableImageUrl,
  isUnavailablePlaceholderImage,
  isLikelyGeneratedImage,
} from "@/lib/place-images"

const resolvedImageCache = new Map<string, ResolvedPlaceImage>()
const pendingRequests = new Map<string, Promise<ResolvedPlaceImage>>()

function shouldResolveRemotely(url?: string | null) {
  const value = String(url || "").trim()
  if (!value) return true
  if (value.startsWith("/api/images/google-photo")) return false
  if (/upload\.wikimedia\.org/i.test(value)) return false
  if (/^data:image\//i.test(value)) return true
  if (/unsplash/i.test(value)) return true
  return isLikelyGeneratedImage(value)
}

function pickInitialImage(input: PlaceImageInput) {
  const candidates = [input.image, input.imageFallback]
    .map((value) => String(value || "").trim())
    .filter((value) => isRenderableImageUrl(value) && !isUnavailablePlaceholderImage(value))

  return candidates[0] || buildImageUnavailablePlaceholder(input)
}

function shouldIncludeInResolverRequest(value?: string | null) {
  const normalized = String(value || "").trim()
  if (!normalized) return false
  if (/^data:image\//i.test(normalized)) return false
  return normalized.length <= 1200
}

function buildInitialResolved(input: PlaceImageInput): ResolvedPlaceImage {
  const imageUrl = pickInitialImage(input)

  return {
    imageUrl,
    blurDataUrl: buildPlaceImageBlurPlaceholder(input),
    source: isUnavailablePlaceholderImage(imageUrl) ? "placeholder" : imageUrl.startsWith("data:image/") ? "static" : "static",
    relevanceScore: isUnavailablePlaceholderImage(imageUrl) ? 0 : imageUrl.startsWith("data:image/") ? 38 : 45,
    resolvedQuery: buildPlaceImageQuery(input),
    placeholder: isUnavailablePlaceholderImage(imageUrl),
  }
}

async function fetchResolvedPlaceImage(input: PlaceImageInput): Promise<ResolvedPlaceImage> {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries({
    key: input.key,
    id: input.id,
    name: input.name,
    city: input.city,
    state: input.state,
    country: input.country,
    category: input.category,
    imageQuery: input.imageQuery,
    image: shouldIncludeInResolverRequest(input.image) ? input.image : undefined,
    imageFallback: shouldIncludeInResolverRequest(input.imageFallback) ? input.imageFallback : undefined,
  })) {
    if (value) params.set(key, value)
  }

  if (input.tags?.length) {
    params.set("tags", input.tags.join(","))
  }

  const response = await fetch(`/api/images?${params.toString()}`, {
    method: "GET",
    cache: "force-cache",
  })

  if (!response.ok) {
    return buildInitialResolved(input)
  }

  const data = await response.json()
  return (data?.resolved || buildInitialResolved(input)) as ResolvedPlaceImage
}

export function usePlaceImage(input: PlaceImageInput) {
  const memoKey = [
    input.key,
    input.id,
    input.name,
    input.city,
    input.state,
    input.country,
    input.category,
    input.imageQuery,
    input.image,
    input.imageFallback,
    ...(input.tags || []),
  ].join("|")

  const request = useMemo(
    () => ({
      ...input,
      key: input.key || buildPlaceImageKey(input),
    }),
    [memoKey]
  )

  const cacheKey = request.key || buildPlaceImageKey(request)
  const initial = resolvedImageCache.get(cacheKey) || buildInitialResolved(request)
  const [resolved, setResolved] = useState<ResolvedPlaceImage>(initial)
  const [isLoading, setIsLoading] = useState(!resolvedImageCache.has(cacheKey) && shouldResolveRemotely(request.image))

  useEffect(() => {
    let cancelled = false
    const nextInitial = resolvedImageCache.get(cacheKey) || buildInitialResolved(request)
    setResolved(nextInitial)

    if (!shouldResolveRemotely(request.image) && !shouldResolveRemotely(request.imageFallback)) {
      setIsLoading(false)
      return
    }

    setIsLoading(!resolvedImageCache.has(cacheKey))

    const existing = pendingRequests.get(cacheKey)
    const promise = existing || fetchResolvedPlaceImage(request)
    if (!existing) {
      pendingRequests.set(cacheKey, promise)
    }

    promise
      .then((result) => {
        const finalResult = result.placeholder && !nextInitial.placeholder ? nextInitial : result
        resolvedImageCache.set(cacheKey, finalResult)
        if (!cancelled) {
          setResolved(finalResult)
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolved(buildInitialResolved(request))
          setIsLoading(false)
        }
      })
      .finally(() => {
        pendingRequests.delete(cacheKey)
      })

    return () => {
      cancelled = true
    }
  }, [cacheKey, memoKey])

  return {
    src: resolved.imageUrl,
    blurDataUrl: resolved.blurDataUrl,
    source: resolved.source,
    isLoading,
    resolved,
  }
}
