import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Car,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Clock3,
  RefreshCcw,
  Search,
} from "lucide-react";
import {
  brandOptions,
  mileageRanges,
  priceRanges,
  yearRangesForVehicles,
} from "../../utils/catalog.js";
import { modelOptionsForVehicles } from "../../utils/homeFilters.js";
import { useBeijingTime } from "../../hooks/useBeijingTime.js";

function SelectControl({ label, value, options, icon: Icon, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef(null);
  const menuId = useId();
  const optionItems = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  const selectedOption = optionItems.find(
    (option) => option.value === value,
  ) || {
    value,
    label: value,
  };

  useEffect(() => {
    if (!open) return undefined;
    const dismiss = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open)
      rootRef.current
        ?.querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function toggle() {
    setActiveIndex(
      Math.max(
        0,
        optionItems.findIndex((option) => option.value === value),
      ),
    );
    setOpen((current) => !current);
  }

  function handleKey(event) {
    if (event.key === "Escape" || event.key === "Tab") {
      setOpen(false);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) =>
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? optionItems.length - 1
            : Math.min(
                optionItems.length - 1,
                Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)),
              ),
      );
    } else if (open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      if (optionItems[activeIndex]) onChange(optionItems[activeIndex].value);
      setOpen(false);
    }
  }

  return (
    <div
      className="field"
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <span className="field-label">{label}</span>
      <span className="select-wrap">
        <button
          className={open ? "select-control active" : "select-control"}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={menuId}
          aria-haspopup="listbox"
          aria-activedescendant={open ? `${menuId}-${activeIndex}` : undefined}
          onClick={toggle}
          onKeyDown={handleKey}
        >
          <span className="select-value">
            {Icon ? <Icon size={19} /> : null}
            {selectedOption.label}
          </span>
          <ChevronDown size={19} />
        </button>
        {open ? (
          <span
            className="select-menu"
            role="listbox"
            id={menuId}
            aria-label={label}
          >
            {optionItems.map((option, index) => (
              <button
                key={option.value}
                id={`${menuId}-${index}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={index === activeIndex}
                className={
                  index === activeIndex
                    ? "select-option selected"
                    : "select-option"
                }
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  rootRef.current?.querySelector('[role="combobox"]')?.focus();
                }}
              >
                {option.value === value ? <CheckCircle2 size={16} /> : <span />}
                {option.label}
              </button>
            ))}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function SearchPanel({
  filters,
  setFilters,
  vehiclesData,
  brands = [],
  rates,
  rateStatus,
  lang,
  t,
}) {
  const time = useBeijingTime();
  const modelOptions = useMemo(
    () => modelOptionsForVehicles(vehiclesData, filters.brand, t),
    [filters.brand, vehiclesData, t.selectModel],
  );
  const yearRanges = useMemo(
    () => yearRangesForVehicles(vehiclesData),
    [vehiclesData],
  );
  const setFilter = (key, value) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const reset = () =>
    setFilters({
      brand: "select",
      model: "select",
      price: "all",
      year: "all",
      mileage: "all",
      query: "",
    });

  const dynamicBrands = [
    ...new Set([
      ...brandOptions,
      ...vehiclesData.map((vehicle) => vehicle.brand).filter(Boolean),
      ...brands.map((brand) => brand.nameEn).filter(Boolean),
    ]),
  ];
  const brandSelectOptions = dynamicBrands.map((brand) => ({
    value: brand,
    label:
      brand === "select"
        ? t.selectBrand
        : brand === "all"
          ? t.allBrands
          : brands.find((item) => item.nameEn === brand)?.[
              `name${lang[0].toUpperCase()}${lang.slice(1)}`
            ] || brand,
  }));
  const rangeOptions = (ranges) =>
    ranges.map((range) => ({ value: range.key, label: range.labels[lang] }));

  return (
    <section className="search-section" aria-label={t.search}>
      <div className="container">
        <div className="search-card">
          <div className="rates-bar">
            <strong>
              {"\u00a5"}1 = {rates.cnyRub}
            </strong>
            <span>|</span>
            <strong>
              {"\u00a5"}1 = {rates.cnyUsd}
            </strong>
            <span>|</span>
            <strong>
              {"\u00a5"}1 = {rates.cnyEur}
            </strong>
            <span className="time-chip">
              <Clock3 size={15} />
              {rateStatus === "live" ? t.liveRate : t.fallbackRate} | Beijing:{" "}
              {time} (UTC+8)
            </span>
          </div>

          <div className="filter-grid">
            <SelectControl
              label={t.brandLabel}
              value={filters.brand}
              options={brandSelectOptions}
              icon={Car}
              onChange={(brand) => {
                setFilters((current) => ({
                  ...current,
                  brand,
                  model: "select",
                }));
              }}
            />
            <SelectControl
              label={t.modelLabel}
              value={filters.model}
              options={modelOptions}
              onChange={(model) => setFilter("model", model)}
            />
            <div className="reset-cell">
              <button
                className="reset-button"
                type="button"
                onClick={reset}
                title="Reset"
              >
                <RefreshCcw size={20} />
              </button>
            </div>
            <label className="field search-field">
              <span className="field-label">{t.searchId}</span>
              <span className="search-row">
                <input
                  value={filters.query}
                  onChange={(event) => setFilter("query", event.target.value)}
                  placeholder={t.searchPlaceholder}
                />
                <button type="button">
                  <Search size={18} />
                  {t.search}
                </button>
              </span>
            </label>
            <SelectControl
              label={t.priceLabel}
              value={filters.price}
              options={rangeOptions(priceRanges)}
              onChange={(price) => setFilter("price", price)}
            />
            <SelectControl
              label={t.yearLabel}
              value={filters.year}
              options={rangeOptions(yearRanges)}
              onChange={(year) => setFilter("year", year)}
            />
            <SelectControl
              label={t.mileageLabel}
              value={filters.mileage}
              options={rangeOptions(mileageRanges)}
              icon={CircleGauge}
              onChange={(mileage) => setFilter("mileage", mileage)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
