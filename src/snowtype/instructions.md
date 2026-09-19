
# Implementation instructions

_A guide on how to implement tracking for the generated Event Specifications._

**Table of contents:**
- [Remove From Basket](#remove-from-basket)
- [View Product](#view-product)
- [Progress Checkout Step](#progress-checkout-step)
- [Add To Basket](#add-to-basket)
- [Complete Transaction](#complete-transaction)
- [Perform Search](#perform-search)


## [Remove From Basket](https://console.snowplowanalytics.com/b12539df-a711-42bd-bdfa-175308c55fd5/data-products/9e64295e-1e49-40d3-81b3-71a9b1873e84/event-specifications/059669a8-d667-4603-bd83-710994167c66)

|       |  |
| ----------- | ----------- |  
| **Id** | 059669a8-d667-4603-bd83-710994167c66 |
| **Version** | 0 |
| **Data Product Id** | 9e64295e-1e49-40d3-81b3-71a9b1873e84 | 
| **Source Application/s** | None selected |
| **Event Data Structure** | snowplow_ecommerce_action/1-0-2 |
| **Entity Data Structures** | cart/1-0-0, product/1-0-0 |
| **Code** | [Link](./snowplow.ts#L254) |
| **Data Product Domain** | _N/A_ |

### Implementation Instructions for snowplow_ecommerce_action event properties

#### Property Rules
|    Name   | Required  | Description |  Exact value(s) expected |
| ----------- | ----------- |  ----------- |  ----------- |  
name | ❌ | - | -
type | ✅ | - | `remove_from_cart`


#### Entity Cardinality Rules
|    Name   | Required  | Number of entities  |
| ----------- | ----------- |  ----------- |
product | ✅ | Exactly `1`
cart | ✅ | Exactly `1`




## [View Product](https://console.snowplowanalytics.com/b12539df-a711-42bd-bdfa-175308c55fd5/data-products/9e64295e-1e49-40d3-81b3-71a9b1873e84/event-specifications/16d74354-595f-4935-8423-fabf7bdd5be1)

|       |  |
| ----------- | ----------- |  
| **Id** | 16d74354-595f-4935-8423-fabf7bdd5be1 |
| **Version** | 0 |
| **Data Product Id** | 9e64295e-1e49-40d3-81b3-71a9b1873e84 | 
| **Source Application/s** | None selected |
| **Event Data Structure** | snowplow_ecommerce_action/1-0-2 |
| **Entity Data Structures** | product/1-0-0 |
| **Code** | [Link](./snowplow.ts#L279) |
| **Data Product Domain** | _N/A_ |

### Implementation Instructions for snowplow_ecommerce_action event properties

#### Property Rules
|    Name   | Required  | Description |  Exact value(s) expected |
| ----------- | ----------- |  ----------- |  ----------- |  
name | ❌ | - | -
type | ✅ | - | `product_view`


#### Entity Cardinality Rules
|    Name   | Required  | Number of entities  |
| ----------- | ----------- |  ----------- |
product | ✅ | Exactly `1`




## [Progress Checkout Step](https://console.snowplowanalytics.com/b12539df-a711-42bd-bdfa-175308c55fd5/data-products/9e64295e-1e49-40d3-81b3-71a9b1873e84/event-specifications/3e6d45e9-ce73-48ff-9fa8-7d1b69726f8a)

|       |  |
| ----------- | ----------- |  
| **Id** | 3e6d45e9-ce73-48ff-9fa8-7d1b69726f8a |
| **Version** | 0 |
| **Data Product Id** | 9e64295e-1e49-40d3-81b3-71a9b1873e84 | 
| **Source Application/s** | None selected |
| **Event Data Structure** | snowplow_ecommerce_action/1-0-2 |
| **Entity Data Structures** | cart/1-0-0, checkout_step/1-0-0 |
| **Code** | [Link](./snowplow.ts#L304) |
| **Data Product Domain** | _N/A_ |

### Implementation Instructions for snowplow_ecommerce_action event properties

#### Property Rules
|    Name   | Required  | Description |  Exact value(s) expected |
| ----------- | ----------- |  ----------- |  ----------- |  
name | ❌ | - | -
type | ✅ | - | `checkout_step`


#### Entity Cardinality Rules
|    Name   | Required  | Number of entities  |
| ----------- | ----------- |  ----------- |
checkout_step | ✅ | Exactly `1`
cart | ✅ | Exactly `1`




## [Add To Basket](https://console.snowplowanalytics.com/b12539df-a711-42bd-bdfa-175308c55fd5/data-products/9e64295e-1e49-40d3-81b3-71a9b1873e84/event-specifications/9d06f6e1-b7e5-4f91-9383-de947a156f7d)

|       |  |
| ----------- | ----------- |  
| **Id** | 9d06f6e1-b7e5-4f91-9383-de947a156f7d |
| **Version** | 0 |
| **Data Product Id** | 9e64295e-1e49-40d3-81b3-71a9b1873e84 | 
| **Source Application/s** | None selected |
| **Event Data Structure** | snowplow_ecommerce_action/1-0-2 |
| **Entity Data Structures** | cart/1-0-0, product/1-0-0 |
| **Code** | [Link](./snowplow.ts#L329) |
| **Data Product Domain** | _N/A_ |

### Implementation Instructions for snowplow_ecommerce_action event properties

#### Property Rules
|    Name   | Required  | Description |  Exact value(s) expected |
| ----------- | ----------- |  ----------- |  ----------- |  
name | ❌ | - | -
type | ✅ | - | `add_to_cart`


#### Entity Cardinality Rules
|    Name   | Required  | Number of entities  |
| ----------- | ----------- |  ----------- |
product | ✅ | Exactly `1`
cart | ✅ | Exactly `1`




## [Complete Transaction](https://console.snowplowanalytics.com/b12539df-a711-42bd-bdfa-175308c55fd5/data-products/9e64295e-1e49-40d3-81b3-71a9b1873e84/event-specifications/a299714a-1bb7-4e20-92ce-4cd2ee454074)

|       |  |
| ----------- | ----------- |  
| **Id** | a299714a-1bb7-4e20-92ce-4cd2ee454074 |
| **Version** | 0 |
| **Data Product Id** | 9e64295e-1e49-40d3-81b3-71a9b1873e84 | 
| **Source Application/s** | None selected |
| **Event Data Structure** | snowplow_ecommerce_action/1-0-2 |
| **Entity Data Structures** | product/1-0-0, transaction/1-0-0 |
| **Code** | [Link](./snowplow.ts#L354) |
| **Data Product Domain** | _N/A_ |

### Implementation Instructions for snowplow_ecommerce_action event properties

#### Property Rules
|    Name   | Required  | Description |  Exact value(s) expected |
| ----------- | ----------- |  ----------- |  ----------- |  
name | ❌ | - | -
type | ✅ | - | `transaction`


#### Entity Cardinality Rules
|    Name   | Required  | Number of entities  |
| ----------- | ----------- |  ----------- |
transaction | ✅ | Exactly `1`
product | ✅ | Between `1` and `100`




## [Perform Search](https://console.snowplowanalytics.com/b12539df-a711-42bd-bdfa-175308c55fd5/data-products/9e64295e-1e49-40d3-81b3-71a9b1873e84/event-specifications/cb1e0fe4-d89b-4d80-abe0-83ca57949b30)

|       |  |
| ----------- | ----------- |  
| **Id** | cb1e0fe4-d89b-4d80-abe0-83ca57949b30 |
| **Version** | 0 |
| **Data Product Id** | 9e64295e-1e49-40d3-81b3-71a9b1873e84 | 
| **Source Application/s** | None selected |
| **Event Data Structure** | search_performed/1-0-0 |
| **Entity Data Structures** |  |
| **Code** | [Link](./snowplow.ts#L228) |
| **Data Product Domain** | _N/A_ |





